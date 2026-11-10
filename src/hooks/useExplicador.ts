"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Explicador } from "@/lib/explicador";
import type { AnonymizeResult } from "@/lib/anonymize";
import type { ChatTurn } from "@/lib/session";
import type { LoadProgress } from "@/lib/llm/types";
import {
  DEFAULT_MODEL_ID,
  LIGHT_MODEL_ID,
  MODEL_OPTIONS,
} from "@/lib/models";
import type { QuickAction } from "@/lib/prompts";
import { checkWebGpu, type WebGpuStatus } from "@/lib/webgpu";

function isLocalModel(id: string) {
  return MODEL_OPTIONS.find((m) => m.id === id)?.tier === "light";
}

export function useExplicador(initialModelId = DEFAULT_MODEL_ID) {
  const ref = useRef<Explicador | null>(null);
  const [webgpu, setWebgpu] = useState<WebGpuStatus | null>(null);
  const [modelId, setModelIdState] = useState(initialModelId);
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>({
    progress: 1,
    text: "Listo para explicar.",
  });
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anonymized, setAnonymized] = useState<AnonymizeResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [lastAssistant, setLastAssistant] = useState("");
  const [mode, setMode] = useState<"openrouter" | "webllm">("openrouter");

  useEffect(() => {
    const engine = new Explicador({ modelId: initialModelId });
    ref.current = engine;
    engine.enableUnloadGuard();
    void checkWebGpu().then(setWebgpu);
    return () => {
      void engine.clearAll();
      ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = useCallback(() => {
    const s = ref.current?.getState();
    if (!s) return;
    setMessages([...s.messages]);
    setLastAssistant(s.lastAssistant);
  }, []);

  const setModelId = useCallback((id: string) => {
    setModelIdState(id);
    if (!ref.current) return;
    if (isLocalModel(id)) {
      ref.current.useLocalWebLlm(id || LIGHT_MODEL_ID);
      setMode("webllm");
      setReady(false);
      setLoadProgress(null);
    } else {
      ref.current.useOpenRouter(id || DEFAULT_MODEL_ID);
      setMode("openrouter");
      setReady(true);
      setLoadProgress({ progress: 1, text: "Listo para explicar." });
    }
  }, []);

  const loadModel = useCallback(
    async (id = modelId) => {
      if (!ref.current) return;
      setBusy(true);
      setError(null);
      setLoadProgress({ progress: 0, text: "Preparando…" });
      try {
        if (isLocalModel(id)) {
          const gpu = await ref.current.ensureWebGpu();
          setWebgpu(gpu);
          if (!gpu.ok) throw new Error(gpu.message);
          ref.current.useLocalWebLlm(id);
          setMode("webllm");
        } else {
          ref.current.useOpenRouter(id);
          setMode("openrouter");
        }
        await ref.current.loadModel((p) => setLoadProgress(p), id);
        setModelIdState(id);
        setReady(true);
      } catch (e) {
        setReady(false);
        setError(e instanceof Error ? e.message : "No se pudo cargar el modelo");
      } finally {
        setBusy(false);
      }
    },
    [modelId],
  );

  const ingestFile = useCallback(async (file: File) => {
    if (!ref.current) return null;
    setBusy(true);
    setError(null);
    setConfirmed(false);
    try {
      const result = await ref.current.ingestPdf(file);
      setAnonymized(result);
      sync();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer el PDF");
      return null;
    } finally {
      setBusy(false);
    }
  }, [sync]);

  const confirmAnonymized = useCallback(
    async (text: string, lexicon: Record<string, string>) => {
      if (!ref.current) return;
      if (mode === "openrouter" && !consent) {
        setError(
          "Tenés que aceptar el aviso de consentimiento antes de enviar el texto reducido.",
        );
        return;
      }
      setBusy(true);
      setError(null);
      try {
        if (mode === "openrouter") {
          ref.current.acceptConsent();
        }
        ref.current.confirmAnonymizedText(text, lexicon);
        setConfirmed(true);
        if (!ready) await loadModel();
        await ref.current.summarizeConfirmed();
        sync();
      } catch (e) {
        setConfirmed(false);
        setError(e instanceof Error ? e.message : "Error al resumir");
      } finally {
        setBusy(false);
      }
    },
    [consent, loadModel, mode, ready, sync],
  );

  const ask = useCallback(
    async (opts: { action?: QuickAction | "custom"; prompt?: string }) => {
      if (!ref.current || !confirmed) return;
      setBusy(true);
      setError(null);
      try {
        await ref.current.ask(opts);
        sync();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error en el chat");
      } finally {
        setBusy(false);
      }
    },
    [confirmed, sync],
  );

  const downloadPdf = useCallback(async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const bytes = await ref.current.exportPdf();
      const blob = new Blob([bytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "guia_ivujus.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar PDF");
    } finally {
      setBusy(false);
    }
  }, []);

  const clearAll = useCallback(async () => {
    await ref.current?.clearAll();
    setAnonymized(null);
    setConfirmed(false);
    setConsent(false);
    setMessages([]);
    setLastAssistant("");
    setMode("openrouter");
    setReady(true);
    setLoadProgress({ progress: 1, text: "Listo para explicar." });
    setError(null);
  }, []);

  return {
    webgpu,
    modelId,
    setModelId,
    models: MODEL_OPTIONS,
    mode,
    loadProgress,
    ready,
    busy,
    error,
    anonymized,
    confirmed,
    consent,
    setConsent,
    messages,
    lastAssistant,
    loadModel,
    ingestFile,
    confirmAnonymized,
    ask,
    downloadPdf,
    clearAll,
    engine: ref,
  };
}
