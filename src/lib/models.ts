export const DEFAULT_MODEL_ID = "google/gemma-4-31b-it:free";
export const FALLBACK_MODEL_ID = "google/gemma-4-26b-a4b-it:free";

/** Límite razonable de caracteres de texto reducido enviados al servidor. */
export const MAX_REDUCED_TEXT_CHARS = 120_000;

/** Límite por mensaje individual. */
export const MAX_MESSAGE_CHARS = 32_000;

/** Máximo de mensajes en el historial enviado. */
export const MAX_MESSAGES = 40;

export type ModelOption = {
  id: string;
  label: string;
  approxDownloadMB?: number;
  tier: "default" | "light" | "heavy" | "cloud";
  notes: string;
};

/** Opciones de UI: cloud por defecto; WebLLM queda opcional. */
export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: DEFAULT_MODEL_ID,
    label: "En la nube (recomendado)",
    tier: "cloud",
    notes: "Default. Texto reducido viaja a OpenRouter → Google AI Studio.",
  },
  {
    id: FALLBACK_MODEL_ID,
    label: "En la nube (alternativa)",
    tier: "cloud",
    notes: "Fallback automático si el 31B no responde.",
  },
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    label: "En tu dispositivo (opcional)",
    approxDownloadMB: 347,
    tier: "light",
    notes: "No sale del navegador. Requiere WebGPU.",
  },
];

export const LIGHT_MODEL_ID = "Qwen3-0.6B-q4f16_1-MLC";
export const CONTEXT_CHAR_BUDGET = MAX_REDUCED_TEXT_CHARS;
