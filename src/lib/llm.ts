import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, streamText, type ModelMessage } from "ai";
import { getModelId } from "./config";
import {
  SYSTEM_PROMPT,
  buildContextBlock,
  introPrompt,
} from "./prompts";

export type LlmTextFn = (args: {
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
}) => Promise<string>;

export function createOpenRouterClient(apiKey = process.env.OPENROUTER_API_KEY) {
  if (!apiKey) {
    throw new Error(
      "Falta OPENROUTER_API_KEY. Configurala en el entorno del servidor.",
    );
  }
  return createOpenRouter({
    apiKey,
    compatibility: "strict",
  });
}

export async function summarizeDocument(
  pdfSnippet: string,
  options?: { generate?: LlmTextFn; modelId?: string },
): Promise<string> {
  if (options?.generate) {
    return options.generate({
      system: SYSTEM_PROMPT,
      prompt: introPrompt(pdfSnippet),
    });
  }

  const openrouter = createOpenRouterClient();
  const modelId = options?.modelId ?? getModelId();
  const { text } = await generateText({
    model: openrouter(modelId),
    system: SYSTEM_PROMPT,
    prompt: introPrompt(pdfSnippet),
    temperature: 0.3,
  });
  return text.trim();
}

export async function streamExplanation(args: {
  pdfText: string;
  messages: ModelMessage[];
  modelId?: string;
}) {
  const openrouter = createOpenRouterClient();
  const modelId = args.modelId ?? getModelId();
  return streamText({
    model: openrouter(modelId),
    system: `${SYSTEM_PROMPT}\n\n${buildContextBlock(args.pdfText)}`,
    messages: args.messages,
    temperature: 0.3,
  });
}

export async function generateExplanation(args: {
  pdfText: string;
  messages: ModelMessage[];
  generate?: LlmTextFn;
  modelId?: string;
}): Promise<string> {
  if (args.generate) {
    return args.generate({
      system: `${SYSTEM_PROMPT}\n\n${buildContextBlock(args.pdfText)}`,
      messages: args.messages,
    });
  }
  const openrouter = createOpenRouterClient();
  const modelId = args.modelId ?? getModelId();
  const { text } = await generateText({
    model: openrouter(modelId),
    system: `${SYSTEM_PROMPT}\n\n${buildContextBlock(args.pdfText)}`,
    messages: args.messages,
    temperature: 0.3,
  });
  return text.trim();
}
