/**
 * Estado volátil en memoria. Nunca localStorage / sessionStorage / IndexedDB
 * para texto del fallo ni del chat.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type SessionState = {
  rawText: string;
  anonymizedText: string;
  lexicon: Record<string, string>;
  messages: ChatTurn[];
  lastAssistant: string;
  modelId: string | null;
};

export function createEmptySession(modelId: string | null = null): SessionState {
  return {
    rawText: "",
    anonymizedText: "",
    lexicon: {},
    messages: [],
    lastAssistant: "",
    modelId,
  };
}

/** Borra referencias sensibles del estado (mutación + nuevo objeto). */
export function wipeSession(state: SessionState): SessionState {
  state.rawText = "";
  state.anonymizedText = "";
  state.lexicon = {};
  state.messages.length = 0;
  state.lastAssistant = "";
  return createEmptySession(state.modelId);
}

export function attachUnloadCleanup(cleanup: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => cleanup();
  window.addEventListener("pagehide", handler);
  window.addEventListener("beforeunload", handler);
  return () => {
    window.removeEventListener("pagehide", handler);
    window.removeEventListener("beforeunload", handler);
  };
}
