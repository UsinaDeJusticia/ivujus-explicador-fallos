# IVUJUS — Explicador de fallos

App de **Usina de Justicia / IVUJUS** que explica fallos judiciales en lenguaje sencillo.

- **Producción:** https://ivujus-explicador-fallos.vercel.app  
- **Código:** este repositorio (público)  
- **Rama de trabajo actual (PR #1):** `feat/client-side-webllm`

## Qué hace (flujo)

1. **Subís un PDF** del fallo. Se lee **solo en el navegador** (`unpdf`). El archivo no se sube a OpenRouter ni a Google.
2. **Reducción de datos personales** en el cliente (reglas argentinas + NER opcional). No es una anonimización perfecta.
3. **Vista previa editable obligatoria:** revisás y corregís el texto antes de seguir.
4. **Aviso y consentimiento:** si usás el modo por defecto (Gemma / OpenRouter), tenés que aceptar que el **texto ya reducido** se envía a nuestro servidor y de ahí a OpenRouter → Google AI Studio. Esos proveedores pueden **retenerlo hasta 55 días** y **no lo usan para entrenar**.
5. Solo ese texto reducido viaja por la ruta mínima **`POST /api/llm`**. Nunca el PDF ni el original sin reducir.
6. El servidor llama a **Gemma 4 31B** (`google/gemma-4-31b-it:free`) por OpenRouter, con respaldo **Gemma 4 26B** (`google/gemma-4-26b-a4b-it:free`). La app pide `provider.data_collection: "deny"` para no rutear a proveedores que entrenen.
7. Gemma genera la explicación en lenguaje sencillo, los botones de ayuda y el chat de seguimiento.
8. El PDF de salida se arma en el navegador. **No se guarda** el fallo ni el chat en base de datos; los logs del proxy solo registran tamaño, duración y código de estado (**sin contenido**).

Más detalle de privacidad: [`docs/PRIVACIDAD.md`](docs/PRIVACIDAD.md).  
Despliegue y variables en Vercel: [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

## Qué datos salen y a dónde

| Dato | ¿Sale del navegador? | Destino |
|---|---|---|
| PDF original | No | Solo memoria del navegador |
| Texto sin reducir | No | Solo memoria del navegador |
| Texto **ya reducido** (tras consentimiento) | Sí | `POST /api/llm` → OpenRouter → Google AI Studio (Gemma) |
| Léxico placeholder→original | No | Solo memoria del navegador |
| Clave `OPENROUTER_API_KEY` | Nunca al navegador | Solo variables de entorno del servidor |

Retención en Google AI Studio: **hasta 55 días**, sin entrenamiento. Ver [`docs/PRIVACIDAD.md`](docs/PRIVACIDAD.md).

## Configuración en Vercel (resumen)

Variables (Production, Preview y Development):

| Variable | Obligatoria | Default en código | Notas |
|---|---|---|---|
| `OPENROUTER_API_KEY` | **Sí** para que funcione `/api/llm` | _(vacía)_ | Si está vacía, `/api/llm` responde **503** y no envía nada. |
| `EXPLICADOR_MODEL` | No | `google/gemma-4-31b-it:free` | Modelo principal. |
| `EXPLICADOR_FALLBACK_MODELS` | No | `google/gemma-4-26b-a4b-it:free` | Lista CSV; se manda en el parámetro `models` de OpenRouter. |
| `ALLOWED_ORIGINS` | No | _(vacío = permitir)_ | Orígenes CORS permitidos, separados por coma. En local suele bastar vacío o `http://localhost:3000`. |

**Cómo cargar la clave** (hoy está creada pero vacía):

1. Vercel → proyecto `ivujus-explicador-fallos` → **Settings** → **Environment Variables**.
2. Editar `OPENROUTER_API_KEY` → pegar la clave → guardar.
3. **Redeployar el último deploy**. Sin redeploy, el runtime no toma el valor nuevo.

Pasos completos y advertencias de ramas: [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

## Despliegue

- Cuenta Vercel: **Usina de Justicia**, proyecto **`ivujus-explicador-fallos`**.
- GitHub conectado:
  - **Producción** hace auto-deploy desde **`main`**.
  - Cada push a una rama / PR genera una **preview** automática (incluida la del PR #1).
- **Hoy** producción tiene la versión de esta rama, subida a mano. **Hasta el merge**, un push a `main` vuelve producción a la versión vieja.

## Límites gratis de OpenRouter

Según la documentación oficial de OpenRouter (límites de la **cuenta**, no de cada clave):

- **20 pedidos por minuto**.
- **50 por día** si la cuenta compró menos de 10 créditos en total.
- **1000 por día** si compró al menos 10 créditos.
- Con **saldo negativo**, incluso los modelos gratis pueden responder **402**.

La app además aplica un rate limit propio de ~20/min por IP en `/api/llm` y muestra un mensaje claro ante 429, con reintento y backoff en el cliente.

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local
# Editar .env.local y poner OPENROUTER_API_KEY=...
pnpm dev
```

Verificación:

```bash
pnpm verify   # lint + typecheck + test + build
```

Requisitos: Node ≥ 22, pnpm 10. No hay export estático: hace falta el runtime de Node para `/api/llm`.

## API de integración (página nueva)

### HTTP — `POST /api/llm`

Body (validado con zod):

```json
{
  "messages": [
    { "role": "system", "content": "…" },
    { "role": "user", "content": "texto ya reducido…" }
  ],
  "stream": false,
  "consent": true,
  "reducedOnly": true
}
```

- `consent` y `reducedOnly` deben ser `true`.
- Límite razonable: ~120 000 caracteres en total entre mensajes; ~32 000 por mensaje; máx. 40 mensajes.
- Respuesta: JSON de Chat Completions de OpenRouter (si `stream: false`) o stream reenviado (si `stream: true`).
- Sin clave: **503**. Origen no permitido: **403**. Body inválido: **400**. Texto demasiado largo: **413**. Rate limit: **429**.

### Cliente — `Explicador` / `useExplicador`

```ts
import { Explicador } from "@/lib/explicador";
import { useExplicador } from "@/hooks/useExplicador";

const engine = new Explicador(); // OpenRouter / Gemma por defecto
const reduced = await engine.ingestPdf(file);
// La persona usuaria revisa reduced.text / reduced.lexicon
engine.acceptConsent();
engine.confirmAnonymizedText(reduced.text, reduced.lexicon);
await engine.summarizeConfirmed();
await engine.ask({ action: "resumen" });
const pdf = await engine.exportPdf();
await engine.clearAll();
```

Interfaz `LlmProvider`: default `OpenRouterProvider` (llama a `/api/llm`); opcional `WebLlmProvider` (local).

## Modo local WebLLM (opcional)

En la UI podés elegir un modelo liviano **Qwen3 0.6B** (WebLLM + WebGPU). En ese modo el texto **no sale del navegador**. Requiere WebGPU (Chrome/Edge). El default sigue siendo Gemma vía OpenRouter.

## Limitaciones

- La reducción de datos puede tapar de más o de menos: por eso la revisión manual es obligatoria.
- PDFs **escaneados sin OCR** no aportan texto útil.
- Modelos gratis de OpenRouter tienen cupos diarios/minuto; sin clave o con clave vacía, `/api/llm` no funciona (503).
- Gemma tiene ventana grande (~262k); igual hay un tope razonable de caracteres en el proxy.

## Estructura del repo

```
src/
  app/                 # Next.js App Router (page + POST /api/llm)
  components/          # UI (ExplicadorApp)
  hooks/               # useExplicador
  lib/
    anonymize.ts       # Reducción de datos personales
    explicador.ts      # API programática
    llm/               # OpenRouterProvider + WebLlmProvider
    ner/               # Reglas + NER opcional (transformers.js)
    server/            # config, cors, rate-limit, openrouter, zod
    pdf-extract.ts     # Lectura de PDF en el cliente
    pdf-generate.ts    # PDF de salida
  workers/             # Web Worker de WebLLM
docs/
  DESPLIEGUE.md
  PRIVACIDAD.md
  ci-workflow.yml      # Plantilla de CI (mover a .github/workflows/ si hace falta)
tests/                 # Vitest (incl. /api/llm con fetch mockeado)
```

## Licencia / uso

Proyecto de Usina de Justicia / IVUJUS. Repo público: no commits de secretos, claves ni datos personales reales.
