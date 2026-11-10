import {
  getFallbackModels,
  getModelId,
  getOpenRouterApiKey,
} from "./config";

export type OrMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterCallMeta = {
  status: number;
  durationMs: number;
  requestBytes: number;
  responseBytes: number;
  model: string;
};

/**
 * Llama a OpenRouter Chat Completions.
 * Nunca loguear el contenido de messages.
 */
export async function callOpenRouter(options: {
  messages: OrMessage[];
  stream: boolean;
  temperature?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<{ response: Response; meta: OpenRouterCallMeta; bodyBytesEstimate: number }> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("Falta OPENROUTER_API_KEY en el servidor.");
  }

  const model = getModelId();
  const models = getFallbackModels().filter((m) => m !== model);
  const payload = {
    model,
    models,
    messages: options.messages,
    stream: options.stream,
    temperature: options.temperature ?? 0.3,
    provider: {
      data_collection: "deny" as const,
    },
  };
  const body = JSON.stringify(payload);
  const requestBytes = Buffer.byteLength(body, "utf8");
  const started = Date.now();

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://usinadejusticia.org.ar",
      "X-OpenRouter-Title": "IVUJUS Explicador de fallos",
    },
    body,
    signal: options.signal,
  });

  // For non-stream we can measure body; for stream leave 0 until consumed.
  let responseBytes = 0;
  if (!options.stream) {
    const text = await response.clone().text();
    responseBytes = Buffer.byteLength(text, "utf8");
  }

  const meta: OpenRouterCallMeta = {
    status: response.status,
    durationMs: Date.now() - started,
    requestBytes,
    responseBytes,
    model,
  };

  return { response, meta, bodyBytesEstimate: requestBytes };
}

/** Log seguro: solo tamaño, duración y status. */
export function logLlmMeta(meta: OpenRouterCallMeta, extra?: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      event: "llm_proxy",
      status: meta.status,
      durationMs: meta.durationMs,
      requestBytes: meta.requestBytes,
      responseBytes: meta.responseBytes,
      model: meta.model,
      ...extra,
    }),
  );
}
