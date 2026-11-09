import { CONTEXT_CHAR_BUDGET } from "./models";

export type TextChunk = {
  index: number;
  text: string;
};

/**
 * Parte texto largo en chunks con solapamiento ligero para no cortar
 * oraciones a la mitad cuando se puede.
 */
export function chunkText(
  text: string,
  budget = CONTEXT_CHAR_BUDGET,
  overlap = 400,
): TextChunk[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.length <= budget) return [{ index: 0, text: cleaned }];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + budget, cleaned.length);
    if (end < cleaned.length) {
      const window = cleaned.slice(start, end);
      const lastBreak = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf(".\n"),
      );
      if (lastBreak > budget * 0.4) {
        end = start + lastBreak + 1;
      }
    }
    chunks.push({ index, text: cleaned.slice(start, end).trim() });
    index += 1;
    if (end >= cleaned.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

export function buildChunkSummaryPrompt(chunk: TextChunk, total: number): string {
  return `Resumí en lenguaje sencillo el fragmento ${chunk.index + 1} de ${total} de un documento judicial. Solo hechos del texto, sin inventar.\n\n${chunk.text}`;
}

export function buildSynthesisPrompt(summaries: string[]): string {
  return `Uní estos resúmenes parciales de un mismo fallo en UNA explicación clara en español rioplatense, lectura fácil, sin tecnicismos. No inventes datos.\n\n${summaries
    .map((s, i) => `### Parte ${i + 1}\n${s}`)
    .join("\n\n")}`;
}
