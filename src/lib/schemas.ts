import { z } from "zod";
import { MAX_EXPLANATION_CHARS, MAX_PDF_TEXT_CHARS } from "./config";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(16_000),
});

export const explicarJsonSchema = z
  .object({
    text: z.string().min(1).max(MAX_PDF_TEXT_CHARS).optional(),
  })
  .strict();

export const chatBodySchema = z
  .object({
    pdfText: z.string().min(1).max(MAX_PDF_TEXT_CHARS),
    messages: z.array(chatMessageSchema).max(40).default([]),
    /** Acción rápida (equivalente a los botones del Space). */
    action: z
      .enum([
        "resumen",
        "pasos",
        "glosario",
        "contacto",
        "custom",
      ])
      .optional(),
    prompt: z.string().min(1).max(4_000).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.action && !val.prompt && val.messages.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Hace falta action, prompt o messages.",
      });
    }
  });

export const pdfBodySchema = z
  .object({
    text: z.string().min(1).max(MAX_EXPLANATION_CHARS),
    title: z.string().max(200).optional(),
  })
  .strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;
