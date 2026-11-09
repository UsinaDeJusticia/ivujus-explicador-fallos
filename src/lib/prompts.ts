/**
 * Prompts portados del Space Streamlit (app.py), con el tono IVUJUS
 * de lectura fácil y la "regla de la brújula".
 */

export const SYSTEM_PROMPT = `Eres un experto del IVUJUS (Instituto de Víctimas de Usina de Justicia).
Misión: explicar fallos y documentos judiciales con LECTURA FÁCIL, en español rioplatense claro, sin tecnicismos innecesarios.

REGLA DE LA BRÚJULA: Si el usuario se desvía del tema legal, desvaría o muestra una angustia que le impide enfocarse, respondé con:
1. Una frase corta de validación empática.
2. Un recordatorio amable de que estás acá para ayudarle a entender el documento judicial y que eso le dará claridad.
3. Una pregunta cerrada para volver al texto.

No inventes datos que no estén en el documento. Si algo no aparece en el texto, decilo.
Usá párrafos cortos y, cuando ayude, listas.`;

export function buildContextBlock(pdfText: string): string {
  return `CONTEXTO DEL DOCUMENTO JUDICIAL:\n${pdfText}`;
}

export function introPrompt(pdfSnippet: string): string {
  return `Analizá el siguiente fragmento de un documento judicial y decime en UNA frase simple qué se decidió o de qué trata. Sin jerga.\n\n${pdfSnippet}`;
}

export function welcomeMessage(summary: string): string {
  return `He leído el documento. Me parece que trata sobre: **${summary.trim()}**\n\n¿Qué te gustaría que te explique primero?`;
}

export const QUICK_ACTIONS = {
  resumen: "Hazme un resumen simple de lo más importante del documento.",
  pasos: "Explícame los pasos a seguir o cómo sigue el caso, según el documento.",
  glosario: "Explicá los términos difíciles del documento en un glosario sencillo.",
  contacto:
    "Comprendo. Podés contactar al equipo de la Usina de Justicia en su sitio web para apoyo humano.",
} as const;

export type QuickAction = keyof typeof QUICK_ACTIONS;
