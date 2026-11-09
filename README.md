# IVUJUS — Explicador de fallos

App **Next.js (App Router) + TypeScript** que explica fallos y documentos judiciales en lenguaje sencillo. Nace como versión curada del Space de Hugging Face `ejaircastillo/ivujus-explicador-fallos`, pensada para Vercel y para que **otra página** consuma la misma API.

> El Space de Hugging Face **no se modifica** con este repo.

## Qué hace

1. Subís un PDF (o mandás el texto ya extraído).
2. El servidor resume en una frase qué trata el documento (OpenRouter vía Vercel AI SDK).
3. Podés usar botones de ayuda rápida o chatear con el fallo como contexto.
4. Descargás la explicación en PDF con tildes y ñ (fuente Noto Sans embebida).

La clave de OpenRouter vive **solo en el servidor**. No se pide en la UI.

## Requisitos

- Node.js 22+
- pnpm 10+
- `OPENROUTER_API_KEY` para rutas que llaman al modelo

## Cómo correrlo

```bash
pnpm install
cp .env.example .env.local
# completá OPENROUTER_API_KEY (y opcionalmente EXPLICADOR_MODEL / ALLOWED_ORIGINS)
pnpm dev
```

Verificación local:

```bash
pnpm verify   # lint + typecheck + test + build
```

## Variables de entorno

| Nombre | Uso |
|---|---|
| `OPENROUTER_API_KEY` | API key de OpenRouter (obligatoria en servidor) |
| `EXPLICADOR_MODEL` | Id OpenRouter; default `mistralai/mistral-nemo` |
| `ALLOWED_ORIGINS` | Lista CSV de orígenes CORS (o `*` en desarrollo) |

## Contratos de la API

Base: misma origin o CORS según `ALLOWED_ORIGINS`. Rate limit simple por IP (~30 req/min).

### `POST /api/explicar`

- **multipart/form-data** con campo `file` (PDF), o
- **JSON** `{ "text": "..." }`

Respuesta `200`:

```json
{
  "text": "texto extraído (posible truncado)",
  "truncated": false,
  "pageCount": 3,
  "summary": "frase simple",
  "welcome": "He leído el documento..."
}
```

### `POST /api/chat`

JSON:

```json
{
  "pdfText": "...",
  "messages": [{ "role": "user", "content": "..." }],
  "action": "resumen | pasos | glosario | contacto | custom",
  "prompt": "opcional si action=custom"
}
```

- `action=contacto` → JSON estático (sin LLM).
- resto → **stream de texto** (`text/plain` stream vía AI SDK) o JSON si es estático.

### `POST /api/pdf`

JSON `{ "text": "...", "title": "opcional" }` → PDF (`application/pdf`).

## Integración desde otra página

La lógica reutilizable está en `src/lib/` (`explicador.ts`, `pdf-extract.ts`, `pdf-generate.ts`, `prompts.ts`, `llm.ts`). La UI de este repo es mínima y solo llama a las rutas `/api/*`. Tu página puede:

1. Llamar a estos endpoints por HTTP (recomendado con `ALLOWED_ORIGINS`), o
2. Importar los módulos de `src/lib` si vivís en el mismo monorepo.

## Modelo default

Verificado contra `https://openrouter.ai/api/v1/models` el 2026-11-09:

- **`mistralai/mistral-nemo`** — económico (~USD 0.03 / M tokens), contexto 131k, buen español.
- Se puede cambiar con `EXPLICADOR_MODEL` sin redeploy de código (solo env).

## Portado / reemplazado / descartado (vs Space)

**Portado**

- Flujo PDF → resumen → botones → chat → descarga PDF
- Tono IVUJUS y “regla de la brújula”
- Acciones rápidas (resumen, pasos, glosario, contacto humano)

**Reemplazado**

- Streamlit → Next.js App Router + TypeScript + pnpm
- Groq + `llama-3.3-70b-versatile` (retirado) → Vercel AI SDK + OpenRouter (`EXPLICADOR_MODEL`)
- PyPDF2 → `unpdf`
- fpdf (latin-1) → `pdf-lib` + Noto Sans (Unicode)
- Key en sidebar → solo `OPENROUTER_API_KEY` de servidor
- Deps sin pin → lockfile pnpm + CI

**Descartado**

- Dockerfile fantasma del template HF
- Input de API key en la UI
- Hugging Face Spaces / secrets del Space
- Deploy automático (este repo no crea proyecto Vercel)


## CI

El workflow de GitHub Actions está en `docs/ci-workflow.yml` (lint, typecheck, test, build).
Para activarlo: mové ese archivo a `.github/workflows/ci.yml` desde la UI de GitHub o con un token que tenga scope `workflow`.

## Licencia

Uso interno Usina de Justicia / IVUJUS.
