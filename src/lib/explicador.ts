import {
  anonymizeTextAsync,
  deanonymizeText,
  type AnonymizeResult,
} from "./anonymize";
import type { NerEngine } from "./ner/types";
import { RulesOnlyNer } from "./ner/rules-only";
import { tryCreateTransformersNer } from "./ner/transformers-ner";
import {
  buildChunkSummaryPrompt,
  buildSynthesisPrompt,
  chunkText,
} from "./chunking";
import { DEFAULT_MODEL_ID } from "./models";
import { extractPdfText } from "./pdf-extract";
import { buildExplanationPdf } from "./pdf-generate";
import {
  QUICK_ACTIONS,
  SYSTEM_PROMPT,
  introPrompt,
  welcomeMessage,
  type QuickAction,
} from "./prompts";
import {
  attachUnloadCleanup,
  createEmptySession,
  wipeSession,
  type ChatTurn,
  type SessionState,
} from "./session";
import { checkWebGpu } from "./webgpu";
import type { LlmProvider, LoadProgress } from "./llm/types";
import { WebLlmProvider } from "./llm/webllm-provider";

export type ExplicadorOptions = {
  modelId?: string;
  provider?: LlmProvider;
  /** Si true, intenta reponer placeholders en la respuesta (solo memoria). */
  deanonymizeOutput?: boolean;
  /**
   * Intentá cargar NER con transformers.js (ONNX). Si falla, queda solo reglas.
   * Default false para no hinchar la primera carga.
   */
  enableNer?: boolean;
};

/**
 * API programática para integrar desde otra página (mismo origen / bundler).
 * Todo corre en el cliente; no hay llamadas a servidores de IA.
 */
export class Explicador {
  private session: SessionState;
  private provider: LlmProvider;
  private detachUnload: (() => void) | null = null;
  private anonymized: AnonymizeResult | null = null;
  private deanonymizeOutput: boolean;
  private ner: NerEngine = new RulesOnlyNer();
  private enableNer: boolean;

  constructor(options: ExplicadorOptions = {}) {
    this.provider = options.provider ?? new WebLlmProvider();
    this.session = createEmptySession(options.modelId ?? DEFAULT_MODEL_ID);
    this.deanonymizeOutput = options.deanonymizeOutput ?? false;
    this.enableNer = options.enableNer ?? false;
  }

  getState(): Readonly<SessionState> {
    return this.session;
  }

  getAnonymizeResult(): AnonymizeResult | null {
    return this.anonymized;
  }

  async ensureWebGpu() {
    return checkWebGpu();
  }

  async loadModel(onProgress?: (p: LoadProgress) => void, modelId?: string) {
    const gpu = await checkWebGpu();
    if (!gpu.ok) throw new Error(gpu.message);
    const id = modelId ?? this.session.modelId ?? DEFAULT_MODEL_ID;
    this.session.modelId = id;
    await this.provider.load(id, onProgress);
  }

  async ingestPdf(file: File | ArrayBuffer | Uint8Array) {
    const bytes =
      file instanceof File ? new Uint8Array(await file.arrayBuffer()) : file;
    const extracted = await extractPdfText(bytes);
    return await this.ingestText(extracted.text);
  }

  async ensureNer(onProgress?: (msg: string) => void): Promise<void> {
    if (!this.enableNer) return;
    if (this.ner.kind === "transformers" && this.ner.isReady()) return;
    const loaded = await tryCreateTransformersNer(onProgress);
    this.ner = loaded ?? new RulesOnlyNer();
  }

  async ingestText(text: string): Promise<AnonymizeResult> {
    this.session.rawText = text;
    await this.ensureNer();
    this.anonymized = await anonymizeTextAsync(text, { ner: this.ner });
    this.session.anonymizedText = this.anonymized.text;
    this.session.lexicon = { ...this.anonymized.lexicon };
    this.session.messages = [];
    this.session.lastAssistant = "";
    return this.anonymized;
  }

  /** El usuario confirma (o corrige) el texto anonimizado antes del modelo. */
  confirmAnonymizedText(text: string, lexicon?: Record<string, string>) {
    this.session.anonymizedText = text;
    if (lexicon) this.session.lexicon = { ...lexicon };
  }

  async summarizeConfirmed(): Promise<string> {
    const snippet = this.session.anonymizedText.slice(0, 4_000);
    const summary = await this.provider.chat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: introPrompt(snippet) },
    ]);
    const welcome = welcomeMessage(summary);
    this.session.messages = [{ role: "assistant", content: welcome }];
    this.session.lastAssistant = welcome;
    return welcome;
  }

  async ask(opts: {
    action?: QuickAction | "custom";
    prompt?: string;
  }): Promise<string> {
    if (opts.action === "contacto") {
      const content = QUICK_ACTIONS.contacto;
      this.push("user", "Necesito hablar con alguien");
      this.push("assistant", content);
      return content;
    }

    const userText =
      opts.action && opts.action !== "custom"
        ? QUICK_ACTIONS[opts.action]
        : opts.prompt?.trim();
    if (!userText) throw new Error("Falta action o prompt.");

    this.push("user", userText);

    const answer = await this.runWithChunking(userText);
    const finalText = this.deanonymizeOutput
      ? deanonymizeText(answer, this.session.lexicon)
      : answer;
    this.push("assistant", finalText);
    return finalText;
  }

  private async runWithChunking(userText: string): Promise<string> {
    const chunks = chunkText(this.session.anonymizedText);
    if (chunks.length <= 1) {
      return this.provider.chat([
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nCONTEXTO:\n${this.session.anonymizedText}`,
        },
        ...this.session.messages
          .slice(0, -1)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userText },
      ]);
    }

    const partials: string[] = [];
    for (const chunk of chunks) {
      const summary = await this.provider.chat([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: buildChunkSummaryPrompt(chunk, chunks.length),
        },
      ]);
      partials.push(summary);
    }
    return this.provider.chat([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildSynthesisPrompt(partials)}\n\nPedido del usuario: ${userText}`,
      },
    ]);
  }

  async exportPdf(text?: string): Promise<Uint8Array> {
    const body = text ?? this.session.lastAssistant;
    if (!body) throw new Error("No hay explicación para exportar.");
    return buildExplanationPdf({ text: body });
  }

  enableUnloadGuard() {
    this.detachUnload?.();
    this.detachUnload = attachUnloadCleanup(() => {
      void this.clearAll();
    });
  }

  async clearAll() {
    wipeSession(this.session);
    this.anonymized = null;
    this.provider.abort();
    await this.provider.dispose();
    await this.ner.dispose?.();
    this.ner = new RulesOnlyNer();
  }

  private push(role: ChatTurn["role"], content: string) {
    this.session.messages.push({ role, content });
    if (role === "assistant") this.session.lastAssistant = content;
  }
}

export { QUICK_ACTIONS, DEFAULT_MODEL_ID };
