import { describe, expect, it } from "vitest";
import { chatOnce, explicarFromText } from "@/lib/explicador";
import { checkRateLimit, resetRateLimitForTests } from "@/lib/rate-limit";

describe("explicador con LLM mock", () => {
  it("resume un texto sin llamar a OpenRouter", async () => {
    const result = await explicarFromText(
      "El tribunal confirma la sentencia absolutoria.",
      {
        generate: async () =>
          "El tribunal confirmó que la persona quedó absuelta.",
      },
    );
    expect(result.summary).toMatch(/absuelta/i);
    expect(result.welcome).toContain(result.summary);
    expect(result.text).toContain("tribunal");
  });

  it("responde contacto sin LLM", async () => {
    const reply = await chatOnce({
      pdfText: "documento",
      messages: [],
      action: "contacto",
    });
    expect(reply.content).toMatch(/Usina de Justicia/i);
  });

  it("usa el mock para una acción de resumen", async () => {
    const reply = await chatOnce({
      pdfText: "Se impone costas al demandado.",
      messages: [],
      action: "resumen",
      generate: async () => "Lo más importante: las costas las paga el demandado.",
    });
    expect(reply.content).toMatch(/costas/i);
  });
});

describe("rate limit", () => {
  it("corta después del máximo", () => {
    resetRateLimitForTests();
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit("test-ip", 30, 60_000).ok).toBe(true);
    }
    expect(checkRateLimit("test-ip", 30, 60_000).ok).toBe(false);
  });
});
