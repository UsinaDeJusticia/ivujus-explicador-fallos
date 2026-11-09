import { describe, expect, it } from "vitest";
import {
  QUICK_ACTIONS,
  introPrompt,
  welcomeMessage,
} from "@/lib/prompts";
import { resolveUserPrompt } from "@/lib/explicador";

describe("prompts IVUJUS", () => {
  it("arma bienvenida con el resumen", () => {
    const msg = welcomeMessage("se hizo lugar a la demanda");
    expect(msg).toContain("se hizo lugar a la demanda");
    expect(msg).toContain("¿Qué te gustaría");
  });

  it("pide una frase simple en el intro", () => {
    expect(introPrompt("texto")).toMatch(/UNA frase/i);
  });

  it("resuelve acciones rápidas", () => {
    expect(resolveUserPrompt({ action: "resumen" }).text).toBe(
      QUICK_ACTIONS.resumen,
    );
    expect(resolveUserPrompt({ action: "contacto" }).kind).toBe("static");
  });
});
