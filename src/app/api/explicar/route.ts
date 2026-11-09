import {
  explicarFromPdfBytes,
  explicarFromText,
  PdfExtractError,
} from "@/lib/explicador";
import { explicarJsonSchema } from "@/lib/schemas";
import { MAX_PDF_BYTES } from "@/lib/config";
import {
  enforceRateLimit,
  handleOptions,
  json,
} from "@/lib/http";


export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") ?? form.get("pdf");
      if (!(file instanceof File)) {
        return json(
          request,
          { error: "Subí un PDF en el campo file (multipart)." },
          { status: 400 },
        );
      }
      if (file.size > MAX_PDF_BYTES) {
        return json(
          request,
          { error: "El PDF supera el tamaño máximo permitido." },
          { status: 413 },
        );
      }
      const bytes = await file.arrayBuffer();
      const result = await explicarFromPdfBytes(bytes);
      return json(request, result);
    }

    const raw = await request.json();
    const parsed = explicarJsonSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.text) {
      return json(
        request,
        {
          error:
            "Enviá multipart con file=PDF, o JSON { text: string }.",
          details: parsed.success ? undefined : parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const result = await explicarFromText(parsed.data.text);
    return json(request, result);
  } catch (err) {
    if (err instanceof PdfExtractError) {
      const status =
        err.code === "TOO_LARGE" ? 413 : err.code === "EMPTY" ? 422 : 400;
      return json(request, { error: err.message, code: err.code }, { status });
    }
    const message = err instanceof Error ? err.message : "Error interno";
    const status = message.includes("OPENROUTER_API_KEY") ? 503 : 500;
    return json(request, { error: message }, { status });
  }
}
