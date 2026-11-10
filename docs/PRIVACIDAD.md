# Privacidad y datos — IVUJUS Explicador de fallos

## Principio

Minimizar lo que sale del navegador. El PDF y el texto original **no** se envían a proveedores de IA. Solo puede salir el **texto ya reducido**, y solo después de una vista previa editable y un **consentimiento explícito**.

## Flujo de datos

```
PDF (navegador)
  → extracción de texto (navegador)
  → reducción de datos personales (navegador)
  → vista previa editable (navegador)
  → consentimiento (navegador)
  → POST /api/llm  [solo texto reducido + mensajes de chat]
       → OpenRouter
            → Google AI Studio (Gemma 4)
  ← explicación / chat
```

## Qué se retiene afuera

- **OpenRouter / Google AI Studio:** pueden retener el contenido enviado hasta **55 días**.
- **No lo usan para entrenar** (según la política aceptada para este proyecto).
- La app envía `provider.data_collection: "deny"` para **no rutear** a proveedores que entrenen con los datos.

## Qué no se guarda en nuestra app

- No hay persistencia del fallo ni del chat en base de datos.
- Los logs del proxy (`/api/llm`) registran únicamente **tamaño** (`requestBytes` / `responseBytes`), **duración** y **código de estado**. **No** se loguea el contenido de los mensajes.
- En el navegador no se usa `localStorage` / `sessionStorage` / IndexedDB para el texto del fallo; “Borrar todo” limpia el estado en memoria. La única caché opcional del lado cliente son pesos de modelos locales (WebLLM / NER), no tu documento.

## Reducción de datos personales

Es una **reducción**, no una garantía de anonimización total. Incluye, entre otras cosas:

- DNI, CUIT/CUIL (con dígito verificador), teléfonos, emails
- Expedientes/causas, patentes
- Matrículas MN/MP, historia clínica, legajo
- Domicilios y referencias catastrales
- Cuasi-identificadores (fechas → mes/año; edades → rangos)
- NER opcional (transformers.js) detrás de interfaz con fallback a reglas

La persona usuaria **debe** revisar el texto antes de enviarlo.

## Modo local (WebLLM)

Si se elige el modelo local opcional, el texto **no sale del navegador** (hace falta WebGPU). El modo por defecto sigue siendo OpenRouter / Gemma.

## Límites y errores relacionados con privacidad / uso

- Sin `OPENROUTER_API_KEY` (o vacía): **503**, no hay envío.
- Rate limit propio o de OpenRouter: **429**, con mensaje claro.
- Saldo negativo en OpenRouter: puede aparecer **402** incluso en modelos gratis.
