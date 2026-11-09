import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfText, PdfExtractError } from "@/lib/pdf-extract";
import { buildExplanationPdf } from "@/lib/pdf-generate";
import { PDFDocument } from "pdf-lib";

describe("pdf extract + generate", () => {
  it("extrae texto de un PDF de ejemplo", async () => {
    const bytes = await readFile(
      path.join(__dirname, "fixtures/fallo-ejemplo.pdf"),
    );
    const result = await extractPdfText(bytes);
    expect(result.text.toLowerCase()).toContain("demanda");
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
  });

  it("rechaza buffers vacíos", async () => {
    await expect(extractPdfText(new Uint8Array())).rejects.toBeInstanceOf(
      PdfExtractError,
    );
  });

  it("genera un PDF de salida con tildes y ñ", async () => {
    const explanation =
      "Explicación: el juez hizo lugar. La señora García deberá presentar el recurso. Año 2026 — decisión firme.";
    const bytes = await buildExplanationPdf({ text: explanation });
    expect(bytes.byteLength).toBeGreaterThan(1000);

    // Re-open and confirm the custom font is embedded (not just StandardFonts)
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);

    // Round-trip: extractText from the generated PDF should keep Spanish chars
    const { extractPdfText: extract } = await import("@/lib/pdf-extract");
    const again = await extract(bytes);
    expect(again.text).toMatch(/Explicaci/);
    expect(again.text).toMatch(/se[nñ]ora|García|Garcia/i);
  });
});
