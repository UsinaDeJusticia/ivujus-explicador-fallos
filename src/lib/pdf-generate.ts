import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { MAX_EXPLANATION_CHARS } from "./config";

async function loadFontBytes(): Promise<Uint8Array> {
  const fontPath = path.join(
    process.cwd(),
    "src/lib/assets/NotoSans-Regular.ttf",
  );
  const buf = await readFile(fontPath);
  return new Uint8Array(buf);
}

function wrapLines(text: string, maxChars: number): string[] {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function buildExplanationPdf(options: {
  text: string;
  title?: string;
}): Promise<Uint8Array> {
  const body = options.text.slice(0, MAX_EXPLANATION_CHARS);
  const title = options.title?.trim() || "Explicación de Ayuda - IVUJUS";

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await loadFontBytes();
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  const margin = 50;
  const fontSizeTitle = 14;
  const fontSizeBody = 11;
  const lineHeight = 16;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const maxWidth = pageWidth - margin * 2;
  const approxCharWidth = font.widthOfTextAtSize("m", fontSizeBody);
  const charsPerLine = Math.max(
    20,
    Math.floor(maxWidth / Math.max(approxCharWidth, 1)),
  );

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = (line: string, size: number, extraGap = false) => {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line || " ", {
      x: margin,
      y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.15),
    });
    y -= extraGap ? lineHeight + 4 : lineHeight;
  };

  drawLine(title, fontSizeTitle, true);
  y -= 8;

  for (const line of wrapLines(body, charsPerLine)) {
    drawLine(line, fontSizeBody);
  }

  return pdfDoc.save();
}
