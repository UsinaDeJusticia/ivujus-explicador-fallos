# Despliegue — IVUJUS Explicador de fallos

## Dónde está

| Ítem | Valor |
|---|---|
| URL de producción | https://ivujus-explicador-fallos.vercel.app |
| Cuenta Vercel | Usina de Justicia |
| Proyecto Vercel | `ivujus-explicador-fallos` |
| Repo GitHub | `UsinaDeJusticia/ivujus-explicador-fallos` (público) |

## Cómo despliega Vercel (GitHub conectado)

1. **Producción:** cada push a **`main`** dispara un deploy de producción.
2. **Previews:** cada push a una rama o a un PR genera una URL de preview automática. El PR #1 (`feat/client-side-webllm`) también tiene preview.

### Advertencia importante (estado actual)

Hoy la **producción** tiene la versión de la rama `feat/client-side-webllm`, subida **a mano**.

Hasta que se haga el **merge** del PR #1 a `main`:

- un **push a `main`** puede volver producción a la **versión vieja**;
- los cambios nuevos de la rama del PR se ven en la **preview** del PR (y en producción solo si se vuelve a publicar a mano o se mergea).

Este documento **no** hace el merge ni toca Vercel: solo describe el estado.

## Variables de entorno

En Vercel → proyecto → **Settings** → **Environment Variables** (marcadas para Production, Preview y Development según corresponda).

### `OPENROUTER_API_KEY` (obligatoria para usar la IA)

- Hoy la variable **existe pero está vacía** en Production, Preview y Development.
- Mientras esté vacía, `POST /api/llm` responde **503** (“Falta OPENROUTER_API_KEY…”) y **no envía nada** a OpenRouter.

Pasos para cargarla:

1. Abrir Vercel → `ivujus-explicador-fallos` → **Settings** → **Environment Variables**.
2. Editar `OPENROUTER_API_KEY`.
3. Pegar la clave de OpenRouter.
4. Guardar.
5. **Redeployar el último deploy** (Deployments → ⋮ → Redeploy).  
   Sin redeploy, el runtime **no** toma el valor nuevo.

Nunca uses prefijo `NEXT_PUBLIC_` para esta clave. No la subas al repo ni al navegador.

### `EXPLICADOR_MODEL` (opcional)

- Default en código: `google/gemma-4-31b-it:free`.
- Si no la definís, se usa ese valor.

### `EXPLICADOR_FALLBACK_MODELS` (opcional)

- Default en código: `google/gemma-4-26b-a4b-it:free`.
- Puede ser una lista separada por comas.
- Se envía a OpenRouter en el parámetro `models` (fallback automático).

### `ALLOWED_ORIGINS` (opcional)

- Lista de orígenes permitidos para CORS, separados por coma.
- **Default en código:** si está vacía o no existe, el proxy **permite** la request (útil en local; same-origin sin header `Origin` también pasa).
- En producción conviene restringir, por ejemplo:  
  `https://ivujus-explicador-fallos.vercel.app`  
  (y el dominio propio de Usina si aplica).

Referencia local: ver `.env.example`.

## Qué no hace falta en el cliente

La CSP (`vercel.json`) permite `connect-src 'self'` para hablar con `/api/llm`. La clave de OpenRouter **no** viaja al browser; el cliente solo llama a la ruta propia del mismo origen.

## Desarrollo local

```bash
pnpm install
cp .env.example .env.local
# OPENROUTER_API_KEY=... en .env.local
pnpm dev
```

Build de producción local:

```bash
pnpm build && pnpm start
```

## CI

Hay una plantilla en `docs/ci-workflow.yml` (lint, typecheck, test, build). Para activarla en GitHub Actions hay que copiarla a `.github/workflows/` (eso requiere permiso de workflows; no está hecho en este PR solo de docs).
