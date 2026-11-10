import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, OPTIONS } from "@/app/api/llm/route";
import { resetRateLimitForTests } from "@/lib/server/rate-limit";
import { DEFAULT_MODEL_ID, FALLBACK_MODEL_ID, MAX_REDUCED_TEXT_CHARS } from "@/lib/models";

function makeRequest(body: unknown, init?: { origin?: string; ip?: string }) {
  return new Request("http://localhost/api/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.origin ? { Origin: init.origin } : {}),
      ...(init?.ip ? { "x-forwarded-for": init.ip } : { "x-forwarded-for": "1.2.3.4" }),
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  messages: [
    { role: "system", content: "sos un asistente" },
    { role: "user", content: "explicá esto" },
  ],
  stream: false,
  consent: true as const,
  reducedOnly: true as const,
};

describe("POST /api/llm", () => {
  const originalEnv = { ...process.env };
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetRateLimitForTests();
    process.env.OPENROUTER_API_KEY = "test-key-not-real";
    process.env.EXPLICADOR_MODEL = DEFAULT_MODEL_ID;
    process.env.ALLOWED_ORIGINS = "http://localhost:3000,https://explicador.example";
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "hola claro" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    resetRateLimitForTests();
  });

  it("OPTIONS responde preflight", () => {
    const res = OPTIONS(
      new Request("http://localhost/api/llm", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      }),
    );
    expect(res.status).toBe(204);
  });

  it("rechaza origen no permitido", async () => {
    const res = await POST(
      makeRequest(validBody, { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
  });

  it("valida body con zod (sin consent)", async () => {
    const res = await POST(
      makeRequest(
        { ...validBody, consent: false },
        { origin: "http://localhost:3000" },
      ),
    );
    expect(res.status).toBe(400);
  });

  it("aplica límite de tamaño", async () => {
    const huge = "x".repeat(MAX_REDUCED_TEXT_CHARS + 10);
    const res = await POST(
      makeRequest(
        {
          ...validBody,
          messages: [{ role: "user", content: huge.slice(0, 32_000) }, { role: "user", content: huge.slice(0, 32_000) }, { role: "user", content: huge.slice(0, 32_000) }, { role: "user", content: huge.slice(0, 32_000) }],
        },
        { origin: "http://localhost:3000" },
      ),
    );
    expect(res.status).toBe(413);
  });

  it("proxy OK y no loguea contenido", async () => {
    const secret = "DATO_SENSIBLE_NO_LOGUEAR_12345";
    const res = await POST(
      makeRequest(
        {
          ...validBody,
          messages: [{ role: "user", content: secret }],
        },
        { origin: "http://localhost:3000" },
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.choices[0].message.content).toBe("hola claro");

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as {
      model: string;
      models: string[];
      provider: { data_collection: string };
    };
    expect(payload.model).toBe(DEFAULT_MODEL_ID);
    expect(payload.models).toContain(FALLBACK_MODEL_ID);
    expect(payload.provider.data_collection).toBe("deny");

    const logged = infoSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
    expect(logged).not.toContain(secret);
    expect(logged).toContain("llm_proxy");
    expect(logged).toContain("requestBytes");
    expect(logged).toContain("durationMs");
  });

  it("mapea 429 de OpenRouter con mensaje claro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "rate" }), {
            status: 429,
            headers: { "Retry-After": "42" },
          }),
      ),
    );
    const res = await POST(
      makeRequest(validBody, { origin: "http://localhost:3000" }),
    );
    expect(res.status).toBe(429);
    const data = (await res.json()) as { code?: string; error?: string };
    expect(data.code).toBe("UPSTREAM_429");
    expect(data.error?.toLowerCase()).toContain("límite");
  });

  it("rate limit por IP", async () => {
    for (let i = 0; i < 20; i++) {
      const res = await POST(
        makeRequest(validBody, {
          origin: "http://localhost:3000",
          ip: "9.9.9.9",
        }),
      );
      expect(res.status).toBe(200);
    }
    const blocked = await POST(
      makeRequest(validBody, {
        origin: "http://localhost:3000",
        ip: "9.9.9.9",
      }),
    );
    expect(blocked.status).toBe(429);
    const data = (await blocked.json()) as { code?: string };
    expect(data.code).toBe("RATE_LIMIT");
  });

  it("503 si falta la API key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const res = await POST(
      makeRequest(validBody, { origin: "http://localhost:3000" }),
    );
    expect(res.status).toBe(503);
  });
});
