# IVUJUS — Explicador de fallos (100% en el navegador)

Explica fallos judiciales en lenguaje sencillo **sin enviar el documento a ningún servidor de IA**. El LLM corre en el cliente con **WebLLM** (`@mlc-ai/web-llm`) sobre **WebGPU**, en un Web Worker.

Export estático (`output: "export"`).

## Arquitectura y privacidad

1. Subís un PDF → texto extraído **en memoria** (`unpdf`).
2. **Reducción de datos personales** (no es anonimización total): reglas argentinas + NER opcional. **Vista previa editable obligatoria** antes del modelo.
3. El modelo local solo ve el texto ya reducido.
4. El PDF de salida se genera en el cliente (`pdf-lib` + Noto Sans).
5. **No** usamos `localStorage`, `sessionStorage` ni IndexedDB para el fallo ni el chat. «Borrar todo» + `beforeunload`/`pagehide` limpian estado y terminan el worker.
6. **Única caché permitida:** pesos del modelo / NER en Cache Storage del navegador (WebLLM / transformers.js). No incluye tu documento.

No hay `/api/*`, OpenRouter, AI SDK de servidor, CORS ni rate limit.

### Reducción de datos (reglas)

- DNI, **CUIT/CUIL con dígito verificador**, teléfonos, emails
- Expedientes/causas, patentes
- Matrículas **MN/MP**, **historia clínica**, **legajo**
- Domicilios (calle/av) y catastro **B° / Mz / Lote**
- **Cuasi-identificadores:** fechas → mes/año; edades → rangos de 5 años
- Heurísticas de personas (roles, Sr./Sra., mayúsculas)

### NER opcional (transformers.js)

Interfaz `NerEngine` con:

- `RulesOnlyNer` (default, siempre disponible)
- `TransformersNer` (`@huggingface/transformers`, ONNX/WASM, sin GPU), modelo `Xenova/bert-base-multilingual-cased-ner-hrl`

Se activa con `new Explicador({ enableNer: true })`. Si la carga falla, cae a solo reglas. La primera vez descarga decenas de MB desde Hugging Face (solo el modelo NER, no tu PDF).

## Requisitos

- Navegador con **WebGPU** (Chrome/Edge recientes).
- Modelo default ≈ **980 MB**: `Qwen3-1.7B-q4f16_1-MLC`.
- Opción liviana ≈ **347 MB**: `Qwen3-0.6B-q4f16_1-MLC`.
- Sin WebGPU: aviso claro y **cero envíos**.

## Cómo correrlo

```bash
pnpm install
pnpm dev
pnpm verify   # lint + typecheck + test + build → /out
```

## Integración (API de cliente)

```ts
import { Explicador } from "@/lib/explicador";
import { useExplicador } from "@/hooks/useExplicador";

const engine = new Explicador({
  modelId: "Qwen3-1.7B-q4f16_1-MLC",
  enableNer: false, // true para NER transformers.js
});
await engine.loadModel((p) => console.log(p.text));
const reduced = await engine.ingestPdf(file);
// el usuario revisa reduced.text / reduced.lexicon
engine.confirmAnonymizedText(reduced.text, reduced.lexicon);
await engine.summarizeConfirmed();
await engine.ask({ action: "resumen" });
const pdf = await engine.exportPdf();
await engine.clearAll();
```

Adaptador `LlmProvider` deja la puerta a un futuro modo servidor **con consentimiento explícito** (`ServerProviderNotImplemented`). No está implementado.

## CSP / headers (`vercel.json`)

- `connect-src`: Hugging Face / CDN LFS + `raw.githubusercontent.com` (pesos WebLLM + wasm MLC + opcional NER).
- Sin analytics.
- `worker-src 'self' blob:`; `script-src` con `'wasm-unsafe-eval'`.

## Modelos

| Id | Rol | Descarga aprox. |
|---|---|---|
| `Qwen3-1.7B-q4f16_1-MLC` | **Default** | ~980 MB |
| `Qwen3-0.6B-q4f16_1-MLC` | Liviano | ~347 MB |
| `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` | Alternativa | ~900 MB |
| `Llama-3.2-3B-Instruct-q4f16_1-MLC` | Más calidad | ~1,8 GB |

## Límites de calidad

- La reducción puede tapar de más o de menos: por eso la revisión manual es obligatoria.
- Modelos chicos pueden fallar en textos jurídicos densos.
- PDFs escaneados sin OCR no aportan texto.
- Fallos largos: resumen por chunks + síntesis.

## Portado / reemplazado / descartado

**Portado:** flujo PDF → explicación → botones → chat → PDF; tono IVUJUS.

**Reemplazado:** OpenRouter/servidor → WebLLM local; API HTTP → `Explicador` / `useExplicador`; extracción/generación PDF 100% cliente; “anonimizar” → **reducción de datos personales** con preview.

**Descartado:** OpenRouter, AI SDK server, `/api/*`, CORS, rate limit, keys en UI, Dockerfile HF.

## CI

Plantilla en `docs/ci-workflow.yml` (mover a `.github/workflows/` con scope `workflow`).
