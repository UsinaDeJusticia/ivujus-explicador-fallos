import type { NerEngine, NerSpan } from "./types";

/**
 * Fallback: no agrega spans NER; el pipeline de reglas regex
 * en `anonymize.ts` hace el trabajo.
 */
export class RulesOnlyNer implements NerEngine {
  readonly kind = "rules-only" as const;
  isReady(): boolean {
    return true;
  }
  async annotate(): Promise<NerSpan[]> {
    return [];
  }
}
