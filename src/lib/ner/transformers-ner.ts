import type { NerEngine, NerEntityType, NerSpan } from "./types";

/**
 * NER opcional con transformers.js (ONNX en el navegador).
 * Se carga en diferido; si falla, el caller debe caer a rules-only.
 *
 * Modelo default: Xenova/bert-base-multilingual-cased-ner-hrl
 * (multilingüe, decenas de MB, CPU/WASM; no requiere WebGPU).
 */
export class TransformersNer implements NerEngine {
  readonly kind = "transformers" as const;
  private classifier: null | ((text: string, opts?: object) => Promise<unknown>) =
    null;
  private modelId: string;

  constructor(
    modelId = "Xenova/bert-base-multilingual-cased-ner-hrl",
  ) {
    this.modelId = modelId;
  }

  isReady(): boolean {
    return this.classifier !== null;
  }

  async load(onProgress?: (msg: string) => void): Promise<void> {
    onProgress?.("Cargando NER (transformers.js)…");
    const { pipeline, env } = await import("@huggingface/transformers");
    // Prefer WASM/CDN caches; allow remote models from HF.
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    // Cast amplio: los tipos de transformers.js son un union enorme.
    this.classifier = (await pipeline(
      "token-classification",
      this.modelId,
    )) as unknown as typeof this.classifier;
    onProgress?.("NER listo.");
  }

  async annotate(text: string): Promise<NerSpan[]> {
    if (!this.classifier) {
      throw new Error("NER no cargado");
    }
    const clipped = text.slice(0, 8_000);
    const raw = (await this.classifier(clipped, {
      aggregation_strategy: "simple",
    })) as Array<{
      entity_group?: string;
      entity?: string;
      word: string;
      start?: number;
      end?: number;
      score?: number;
    }>;

    const spans: NerSpan[] = [];
    for (const item of raw ?? []) {
      const label = (item.entity_group || item.entity || "").toUpperCase();
      const type = mapLabel(label);
      if (!type) continue;
      const start = item.start ?? clipped.indexOf(item.word);
      const end = item.end ?? (start >= 0 ? start + item.word.length : -1);
      if (start < 0 || end < 0) continue;
      spans.push({
        type,
        text: clipped.slice(start, end) || item.word,
        start,
        end,
        score: item.score,
      });
    }
    return spans;
  }

  async dispose(): Promise<void> {
    this.classifier = null;
  }
}

function mapLabel(label: string): NerEntityType | null {
  if (label.includes("PER")) return "PERSON";
  if (label.includes("LOC")) return "LOC";
  if (label.includes("ORG")) return "ORG";
  if (label.includes("MISC")) return "MISC";
  return null;
}

export async function tryCreateTransformersNer(
  onProgress?: (msg: string) => void,
): Promise<NerEngine | null> {
  try {
    const ner = new TransformersNer();
    await ner.load(onProgress);
    return ner;
  } catch (err) {
    console.warn("[ner] transformers.js no disponible, uso solo reglas", err);
    return null;
  }
}
