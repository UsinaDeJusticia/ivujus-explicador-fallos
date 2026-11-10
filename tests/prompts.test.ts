import { describe, expect, it } from "vitest";
import { QUICK_ACTIONS, introPrompt, welcomeMessage } from "@/lib/prompts";

describe("prompts", () => {
  it("bienvenida", () => {
    expect(welcomeMessage("absuelto")).toContain("absuelto");
  });
  it("intro", () => {
    expect(introPrompt("x")).toMatch(/UNA frase/);
  });
  it("acciones", () => {
    expect(QUICK_ACTIONS.contacto).toMatch(/Usina de Justicia/);
  });
});
