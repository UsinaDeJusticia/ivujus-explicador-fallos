import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/chunking";

describe("chunkText", () => {
  it("no parte textos cortos", () => {
    expect(chunkText("hola mundo", 100)).toEqual([
      { index: 0, text: "hola mundo" },
    ]);
  });

  it("parte textos largos con overlap", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Oración número ${i}.`).join(
      " ",
    );
    const chunks = chunkText(text, 80, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.index).toBe(0);
    expect(chunks.at(-1)?.text.length).toBeGreaterThan(0);
  });
});
