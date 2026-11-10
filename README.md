# IVUJUS — Explicador de fallos (OpenRouter / Gemma + reducción en el cliente)

Explica fallos judiciales en lenguaje sencillo. El PDF se parsea en el navegador; la **reducción de datos personales** y la vista previa editable son obligatorias **antes** de enviar. Al servidor solo viaja el **texto ya reducido** (nunca el PDF ni el original). La explicación la genera **Gemma 4** vía **OpenRouter**.

## Arquitectura y qué datos salen

1. Subís un PDF → texto extraído **en memoria** (`unpdf`).
2. **Reducción de datos personales** (reglas AR + NER opcional) + **vista previa editable obligatoria**.
3. Con consentimiento explícito, el texto reducido se envía a `POST /api/llm` (servidor Next.js).
4. El servidor llama a OpenRouter (`OPENROUTER_API_KEY` solo en servidor) con:
   - modelo default `google/gemma-4-31b-it:free` (`EXPLICADOR_MODEL`)
   - fallback `google/gemma-4-26b-a4b-it:free` (parámetro `models`)
   - `provider.data_collection: "deny"` (no rutear a proveedores que entrenen)
5. OpenRouter → Google AI Studio (Gemma). **Pueden retener el contenido hasta 55 días; no lo usan para entrenar** (aceptado por IVUJUS).
6. Respuesta → explicación en lenguaje sencillo, botones de ayuda y chat.
7. PDF de salida en el cliente (`pdf-lib`). Sin persistencia del fallo ni del chat en disco/DB.

**No se loguea contenido:** solo tamaño (`requestBytes`/`responseBytes`), duración y código de estado.

### Límites gratis de OpenRouter (aprox.)

- ~20 requests / minuto
- ~50 o 1000 / día (según cuenta)
- Ante `429`: mensaje claro + reintento con backoff en el cliente

### Modo local opcional

Podés elegir WebLLM (Qwen 0.6B) si hay WebGPU: el texto no sale del navegador. El default es OpenRouter/Gemma.

## Variables de entorno

Ver `.env.example`:

| Variable | Dónde | Descripción |
|---|---|---|
| `OPENROUTER_API_KEY` | servidor | Obligatoria. Nunca `NEXT_PUBLIC_`. |
| `EXPLICADOR_MODEL` | servidor | Default `google/gemma-4-31b-it:free` |
| `EXPLICADOR_FALLBACK_MODELS` | servidor | Lista CSV; default el 26B free |
| `ALLOWED_ORIGINS` | servidor | Orígenes CORS permitidos |

## API de integración

### HTTP (servidor)

`POST /api/llm`

```json
{
  "messages": [{ "role": "user", "content": "texto ya reducido…" }],
  "stream": false,
  "consent": true,
  "reducedOnly": true
}
```

- Validación **zod**, límite ~120k caracteres totales, rate limit ~20/min por IP, `ALLOWED_ORIGINS`.
- Streaming: `stream: true` (default en ruta) reenvía el body de OpenRouter.

### Cliente (`Explicador` / `useExplicador`)

```ts
import { Explicador } from "@/lib/explicador";

const engine = new Explicador(); // OpenRouter por defecto
const reduced = await engine.ingestPdf(file);
// el usuario revisa reduced.text
engine.acceptConsent();
engine.confirmAnonymizedText(reduced.text, reduced.lexicon);
await engine.summarizeConfirmed();
await engine.ask({ action: "resumen" });
```

## Cómo correrlo

```bash
pnpm install
cp .env.example .env.local   # cargar OPENROUTER_API_KEY
pnpm dev
pnpm verify   # lint + typecheck + test + build
```

> Ya no hay export estático: hace falta el runtime de Node para `/api/llm`.

## CSP (`vercel.json`)

`connect-src` incluye `'self'` (proxy) + Hugging Face/CDN (WebLLM/NER opcional). La key nunca va al browser; no hace falta permitir `openrouter.ai` desde el cliente, pero se deja por si se usa en debug.

## Reducción de datos (reglas)

- DNI, CUIT/CUIL con DV, teléfonos, emails, expedientes, patentes
- Matrículas MN/MP, historia clínica, legajo, domicilios, catastro
- Cuasi-identificadores: fechas → mes/año; edades → rangos
- NER opcional con `enableNer: true`

## CI

Plantilla en `docs/ci-workflow.yml`.
