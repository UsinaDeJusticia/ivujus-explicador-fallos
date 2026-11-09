export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LoadProgress = {
  progress: number;
  text: string;
};

/**
 * Adaptador de proveedor LLM.
 * Hoy solo se implementa WebLLM en el cliente.
 * Un futuro modo servidor debería exigir consentimiento explícito
 * y NUNCA ser el default (no implementado acá).
 */
export interface LlmProvider {
  readonly kind: "webllm" | "server-opt-in";
  load(modelId: string, onProgress?: (p: LoadProgress) => void): Promise<void>;
  chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<string>;
  abort(): void;
  dispose(): Promise<void>;
}

export class ServerProviderNotImplemented implements LlmProvider {
  readonly kind = "server-opt-in" as const;
  async load(): Promise<void> {
    throw new Error(
      "El modo servidor no está implementado. Todo corre en el navegador con WebLLM.",
    );
  }
  async chat(): Promise<string> {
    throw new Error("El modo servidor no está implementado.");
  }
  abort(): void {}
  async dispose(): Promise<void> {}
}
