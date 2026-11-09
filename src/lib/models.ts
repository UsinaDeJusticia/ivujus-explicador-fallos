export type ModelOption = {
  id: string;
  label: string;
  /** Peso aproximado de la primera descarga (MB). */
  approxDownloadMB: number;
  tier: "default" | "light" | "heavy";
  notes: string;
};

/**
 * Catálogo curado de modelos prebuilt de WebLLM (@mlc-ai/web-llm 0.2.87).
 * Los pesos se bajan desde Hugging Face; el wasm desde el CDN de MLC.
 */
export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    label: "Qwen3 1.7B (recomendado)",
    approxDownloadMB: 980,
    tier: "default",
    notes: "Multilingüe, buen español, balance calidad/RAM.",
  },
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    label: "Qwen3 0.6B (liviano)",
    approxDownloadMB: 347,
    tier: "light",
    notes: "Para notebooks o PCs con poca VRAM/RAM.",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 1.5B Instruct",
    approxDownloadMB: 900,
    tier: "default",
    notes: "Alternativa instruct estable en español.",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B (más calidad)",
    approxDownloadMB: 1807,
    tier: "heavy",
    notes: "Mejor calidad; pide más memoria y descarga ~1,8 GB.",
  },
];

export const DEFAULT_MODEL_ID = "Qwen3-1.7B-q4f16_1-MLC";
export const LIGHT_MODEL_ID = "Qwen3-0.6B-q4f16_1-MLC";

/** Tokens de contexto aproximados que usamos para chunking (conservador). */
export const CONTEXT_CHAR_BUDGET = 6_000;
