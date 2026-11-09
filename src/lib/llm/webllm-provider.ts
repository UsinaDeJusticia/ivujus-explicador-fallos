import {
  CreateWebWorkerMLCEngine,
  type MLCEngineInterface,
} from "@mlc-ai/web-llm";
import type { ChatMessage, LlmProvider, LoadProgress } from "./types";

export class WebLlmProvider implements LlmProvider {
  readonly kind = "webllm" as const;
  private engine: MLCEngineInterface | null = null;
  private worker: Worker | null = null;
  private loading = false;

  async load(
    modelId: string,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      await this.dispose();
      this.worker = new Worker(
        new URL("../../workers/webllm.worker.ts", import.meta.url),
        { type: "module" },
      );
      this.engine = await CreateWebWorkerMLCEngine(this.worker, modelId, {
        initProgressCallback: (report) => {
          onProgress?.({
            progress: report.progress,
            text: report.text,
          });
        },
      });
    } finally {
      this.loading = false;
    }
  }

  async chat(
    messages: ChatMessage[],
    opts?: { temperature?: number },
  ): Promise<string> {
    if (!this.engine) {
      throw new Error("El modelo todavía no está cargado.");
    }
    const result = await this.engine.chat.completions.create({
      messages,
      temperature: opts?.temperature ?? 0.3,
      stream: false,
    });
    const content = result.choices[0]?.message?.content;
    return typeof content === "string" ? content.trim() : "";
  }

  abort(): void {
    try {
      const ret = this.engine?.interruptGenerate?.();
      void ret;
    } catch {
      // ignore
    }
  }

  async dispose(): Promise<void> {
    try {
      this.abort();
      await this.engine?.unload?.();
    } catch {
      // ignore
    }
    this.engine = null;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
