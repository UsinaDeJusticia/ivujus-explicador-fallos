import { describe, expect, it } from "vitest";
import {
  createEmptySession,
  wipeSession,
} from "@/lib/session";

describe("session wipe", () => {
  it("borra texto, léxico y mensajes", () => {
    const s = createEmptySession("model");
    s.rawText = "secreto";
    s.anonymizedText = "[PERSONA_1]";
    s.lexicon["[PERSONA_1]"] = "Juan";
    s.messages.push({ role: "user", content: "hola" });
    s.lastAssistant = "respuesta";
    const wiped = wipeSession(s);
    expect(wiped.rawText).toBe("");
    expect(wiped.anonymizedText).toBe("");
    expect(Object.keys(wiped.lexicon)).toHaveLength(0);
    expect(wiped.messages).toHaveLength(0);
    expect(wiped.lastAssistant).toBe("");
    expect(s.rawText).toBe("");
  });
});
