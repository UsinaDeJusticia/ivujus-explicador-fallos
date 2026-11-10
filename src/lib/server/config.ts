import { DEFAULT_MODEL_ID, FALLBACK_MODEL_ID } from "@/lib/models";

export function getOpenRouterApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY?.trim() || null;
}

export function getModelId(): string {
  return process.env.EXPLICADOR_MODEL?.trim() || DEFAULT_MODEL_ID;
}

export function getFallbackModels(): string[] {
  const raw = process.env.EXPLICADOR_FALLBACK_MODELS?.trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [FALLBACK_MODEL_ID];
}

export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 20;
