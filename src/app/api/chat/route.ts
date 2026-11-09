import { chatStream } from "@/lib/explicador";
import { chatBodySchema } from "@/lib/schemas";
import {
  enforceRateLimit,
  handleOptions,
  json,
} from "@/lib/http";
import { withCors } from "@/lib/cors";


export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  try {
    const raw = await request.json();
    const parsed = chatBodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(
        request,
        { error: "Body inválido", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const streamed = await chatStream({
      pdfText: body.pdfText,
      messages: body.messages,
      action: body.action,
      prompt: body.prompt,
    });

    if (streamed.kind === "static") {
      return json(request, {
        role: "assistant",
        content: streamed.text,
      });
    }

    return withCors(streamed.result.toTextStreamResponse(), request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    const status = message.includes("OPENROUTER_API_KEY") ? 503 : 500;
    return json(request, { error: message }, { status });
  }
}
