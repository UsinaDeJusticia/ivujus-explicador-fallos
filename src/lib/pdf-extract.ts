import { extractText, getDocumentProxy } from "unpdf";

export class PdfExtractError extends Error {
  constructor(
    message: string,
    readonly code: "TOO_LARGE" | "EMPTY" | "INVALID",
  ) {
    super(message);
    this.name = "PdfExtractError";
  }
}

export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_TEXT_CHARS = 80_000;

export async function extractPdfText(
  data: ArrayBuffer | Uint8Array,
  options?: { maxBytes?: number; maxChars?: number },
): Promise<{ text: string; truncated: boolean; pageCount: number }> {
  const maxBytes = options?.maxBytes ?? MAX_PDF_BYTES;
  const maxChars = options?.maxChars ?? MAX_PDF_TEXT_CHARS;
  const bytes =
    data instanceof Uint8Array
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);

  if (bytes.byteLength === 0) {
    throw new PdfExtractError("El PDF está vacío.", "EMPTY");
  }
  if (bytes.byteLength > maxBytes) {
    throw new PdfExtractError(
      `El PDF supera el máximo de ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      "TOO_LARGE",
    );
  }

  try {
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    const cleaned = result.text.replace(/\u0000/g, "").trim();
    if (!cleaned) {
      throw new PdfExtractError(
        "No se pudo extraer texto del PDF (¿está escaneado sin OCR?).",
        "EMPTY",
      );
    }
    const truncated = cleaned.length > maxChars;
    return {
      text: truncated ? cleaned.slice(0, maxChars) : cleaned,
      truncated,
      pageCount: result.totalPages ?? 0,
    };
  } catch (err) {
    if (err instanceof PdfExtractError) throw err;
    const detail = err instanceof Error ? err.message : String(err);
    throw new PdfExtractError(
      `El archivo no parece un PDF válido o está dañado. (${detail})`,
      "INVALID",
    );
  }
}
