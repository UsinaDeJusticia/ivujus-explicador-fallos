import { llmBodySchema } from "@/lib/server/schemas";
import {
  callOpenRouter,
  logLlmMeta,
} from "@/lib/server/openrouter";
import {
  checkRateLimit,
  clientIp,
} from "@/lib/server/rate-limit";
import {
  originAllowed,
  preflight,
  withCors,
} from "@/lib/server/cors";
import { MAX_REDUCED_TEXT_CHARS } from "@/lib/models";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return preflight(request);
}

function json(request: Request, body: unknown, init?: ResponseInit) {
  return withCors(Response.json(body, init), request);
}

export async function POST(request: Request) {
  if (!originAllowed(request)) {
    return json(request, { error: "Origen no permitido." }, { status: 403 });
  }

  const limited = checkRateLimit(clientIp(request));
  if (!limited.ok) {
    return json(
      request,
      {
        error:
          "Límite de uso alcanzado (gratis: ~20/min). Esperá un momento e intentá de nuevo.",
        code: "RATE_LIMIT",
        retryAfterSec: limited.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(request, { error: "JSON inválido." }, { status: 400 });
  }

  const parsed = llmBodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      request,
      { error: "Body inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const totalChars = parsed.data.messages.reduce(
    (acc, m) => acc + m.content.length,
    0,
  );
  if (totalChars > MAX_REDUCED_TEXT_CHARS) {
    return json(
      request,
      {
        error: `El texto supera el máximo de ${MAX_REDUCED_TEXT_CHARS} caracteres.`,
        code: "TOO_LARGE",
      },
      { status: 413 },
    );
  }

  try {
    const { response, meta } = await callOpenRouter({
      messages: parsed.data.messages,
      stream: parsed.data.stream !== false,
      temperature: parsed.data.temperature,
    });

    if (response.status === 429) {
      logLlmMeta(meta, { code: "UPSTREAM_429" });
      return json(
        request,
        {
          error:
            "OpenRouter/Gemma alcanzó el límite gratis (aprox. 20/min y 50–1000/día). Probá más tarde.",
          code: "UPSTREAM_429",
        },
        {
          status: 429,
          headers: {
            "Retry-After": response.headers.get("retry-after") || "60",
          },
        },
      );
    }

    if (!response.ok) {
      logLlmMeta(meta, { code: "UPSTREAM_ERROR" });
      return json(
        request,
        {
          error: "El proveedor de IA no pudo responder.",
          code: "UPSTREAM_ERROR",
          status: response.status,
        },
        { status: 502 },
      );
    }

    if (parsed.data.stream === false) {
      const text = await response.text();
      meta.responseBytes = Buffer.byteLength(text, "utf8");
      meta.durationMs = meta.durationMs; // already set at fetch return; ok
      logLlmMeta(meta, { code: "OK" });
      return withCors(
        new Response(text, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
        request,
      );
    }

    // Stream SSE/text from OpenRouter through without buffering content for logs.
    logLlmMeta(meta, { code: "OK_STREAM" });
    return withCors(
      new Response(response.body, {
        status: 200,
        headers: {
          "Content-Type":
            response.headers.get("content-type") || "text/event-stream",
          "Cache-Control": "no-store",
        },
      }),
      request,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    const status = message.includes("OPENROUTER_API_KEY") ? 503 : 500;
    console.info(
      JSON.stringify({
        event: "llm_proxy",
        status,
        code: "PROXY_ERROR",
        // sin contenido
      }),
    );
    return json(request, { error: message, code: "PROXY_ERROR" }, { status });
  }
}
