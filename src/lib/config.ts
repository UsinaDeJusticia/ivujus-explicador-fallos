export const DEFAULT_MODEL = "mistralai/mistral-nemo";

/** Límite del PDF de entrada (bytes). */
export const MAX_PDF_BYTES = 8 * 1024 * 1024;

/** Caracteres máximos del texto extraído que se envían al modelo. */
export const MAX_PDF_TEXT_CHARS = 12_000;

/** Caracteres usados en el resumen inicial (bienvenida). */
export const INTRO_TEXT_CHARS = 4_000;

/** Caracteres máximos de una explicación para generar PDF de salida. */
export const MAX_EXPLANATION_CHARS = 20_000;

/** Ventana del rate limit en memoria (ms). */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Requests por IP dentro de la ventana. */
export const RATE_LIMIT_MAX = 30;

export function getModelId(): string {
  return process.env.EXPLICADOR_MODEL?.trim() || DEFAULT_MODEL;
}

export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
