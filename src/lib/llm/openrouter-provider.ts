import type { ChatMessage, ChatOptions, LlmProvider } from "./types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Cliente que habla con nuestra ruta `/api/llm` (nunca con la key en el browser).
 */
export class OpenRouterProvider implements LlmProvider {
  readonly kind = "openrouter" as const;
  private aborted = false;

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string> {
    if (!opts?.consent || !opts?.reducedOnly) {
      throw new Error(
        "Falta el consentimiento explícito o la confirmación de texto reducido.",
      );
    }

    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (this.aborted) throw new Error("Cancelado.");
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          stream: false,
          temperature: opts.temperature ?? 0.3,
          consent: true,
          reducedOnly: true,
        }),
      });

      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retryAfterSec?: number;
          error?: string;
        };
        const retryAfterSec = data.retryAfterSec || Number(res.headers.get("Retry-After")) || 60;
        opts.onRetry?.(attempt, retryAfterSec);
        lastError = new Error(
          data.error ||
            `Límite de uso. Reintentá en ~${retryAfterSec}s.`,
        );
        if (attempt < maxAttempts) {
          await sleep(Math.min(30_000, retryAfterSec * 1000 * attempt));
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Error del servidor (${res.status})`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("Respuesta vacía del modelo.");
      }
      return content.trim();
    }

    throw lastError || new Error("No se pudo completar la solicitud.");
  }

  abort(): void {
    this.aborted = true;
  }

  async dispose(): Promise<void> {
    this.aborted = false;
  }
}
