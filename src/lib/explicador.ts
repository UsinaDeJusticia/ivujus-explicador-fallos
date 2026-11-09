import { INTRO_TEXT_CHARS } from "./config";
import {
  QUICK_ACTIONS,
  welcomeMessage,
  type QuickAction,
} from "./prompts";
import {
  generateExplanation,
  summarizeDocument,
  streamExplanation,
  type LlmTextFn,
} from "./llm";
import { extractPdfText, PdfExtractError } from "./pdf-extract";
import { buildExplanationPdf } from "./pdf-generate";
import type { ChatMessage } from "./schemas";
import type { ModelMessage } from "ai";

export { PdfExtractError, QUICK_ACTIONS };
export type { QuickAction };

function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

export async function explicarFromPdfBytes(
  bytes: ArrayBuffer | Uint8Array,
  options?: { generate?: LlmTextFn },
) {
  const extracted = await extractPdfText(bytes);
  const summary = await summarizeDocument(
    extracted.text.slice(0, INTRO_TEXT_CHARS),
    { generate: options?.generate },
  );
  const welcome = welcomeMessage(summary);
  return {
    text: extracted.text,
    truncated: extracted.truncated,
    pageCount: extracted.pageCount,
    summary,
    welcome,
  };
}

export async function explicarFromText(
  text: string,
  options?: { generate?: LlmTextFn },
) {
  const clipped = text.trim().slice(0, INTRO_TEXT_CHARS);
  const summary = await summarizeDocument(clipped, {
    generate: options?.generate,
  });
  return {
    text: text.trim(),
    truncated: false,
    pageCount: 0,
    summary,
    welcome: welcomeMessage(summary),
  };
}

export function resolveUserPrompt(input: {
  action?: QuickAction | "custom";
  prompt?: string;
}): { kind: "static"; text: string } | { kind: "llm"; text: string } {
  if (input.action === "contacto") {
    return { kind: "static", text: QUICK_ACTIONS.contacto };
  }
  if (input.action && input.action !== "custom") {
    return { kind: "llm", text: QUICK_ACTIONS[input.action] };
  }
  if (input.prompt?.trim()) {
    return { kind: "llm", text: input.prompt.trim() };
  }
  throw new Error("Falta action o prompt.");
}

export async function chatOnce(args: {
  pdfText: string;
  messages: ChatMessage[];
  action?: QuickAction | "custom";
  prompt?: string;
  generate?: LlmTextFn;
}): Promise<{ role: "assistant"; content: string }> {
  const resolved = resolveUserPrompt({
    action: args.action,
    prompt: args.prompt,
  });
  if (resolved.kind === "static") {
    return { role: "assistant", content: resolved.text };
  }

  const history = toModelMessages(args.messages);
  history.push({ role: "user", content: resolved.text });
  const content = await generateExplanation({
    pdfText: args.pdfText,
    messages: history,
    generate: args.generate,
  });
  return { role: "assistant", content };
}

export async function chatStream(args: {
  pdfText: string;
  messages: ChatMessage[];
  action?: QuickAction | "custom";
  prompt?: string;
}) {
  const resolved = resolveUserPrompt({
    action: args.action,
    prompt: args.prompt,
  });
  if (resolved.kind === "static") {
    return { kind: "static" as const, text: resolved.text };
  }
  const history = toModelMessages(args.messages);
  history.push({ role: "user", content: resolved.text });
  const result = await streamExplanation({
    pdfText: args.pdfText,
    messages: history,
  });
  return { kind: "stream" as const, result };
}

export async function explanationToPdf(text: string, title?: string) {
  return buildExplanationPdf({ text, title });
}
