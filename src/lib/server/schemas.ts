import { z } from "zod";
import { MAX_MESSAGE_CHARS, MAX_MESSAGES } from "@/lib/models";

export const llmMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(MAX_MESSAGE_CHARS),
});

export const llmBodySchema = z
  .object({
    messages: z.array(llmMessageSchema).min(1).max(MAX_MESSAGES),
    stream: z.boolean().optional().default(true),
    temperature: z.number().min(0).max(1).optional(),
    /** Debe ser true: el cliente confirma consentimiento + texto reducido. */
    consent: z.literal(true),
    reducedOnly: z.literal(true),
  })
  .strict();

export type LlmBody = z.infer<typeof llmBodySchema>;
