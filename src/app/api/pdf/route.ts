import { explanationToPdf } from "@/lib/explicador";
import { pdfBodySchema } from "@/lib/schemas";
import {
  enforceRateLimit,
  handleOptions,
  json,
} from "@/lib/http";
import { withCors } from "@/lib/cors";


export function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  try {
    const raw = await request.json();
    const parsed = pdfBodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(
        request,
        { error: "Body inválido", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const bytes = await explanationToPdf(parsed.data.text, parsed.data.title);
    const response = new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="guia_ivujus.pdf"',
      },
    });
    return withCors(response, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return json(request, { error: message }, { status: 500 });
  }
}
