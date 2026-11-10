export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LoadProgress = {
  progress: number;
  text: string;
};

export type ChatOptions = {
  temperature?: number;
  /** Consentimiento explícito para enviar texto reducido a OpenRouter. */
  consent?: boolean;
  /** Confirma que messages solo contienen texto reducido. */
  reducedOnly?: boolean;
  onRetry?: (attempt: number, retryAfterSec: number) => void;
};

/**
 * Adaptador de proveedor LLM.
 * Default: OpenRouter (Gemma) vía `/api/llm` (servidor).
 * Opcional: WebLLM local.
 */
export interface LlmProvider {
  readonly kind: "openrouter" | "webllm";
  load?(modelId: string, onProgress?: (p: LoadProgress) => void): Promise<void>;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  abort(): void;
  dispose(): Promise<void>;
}
