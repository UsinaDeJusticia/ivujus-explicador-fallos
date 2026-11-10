import { describe, expect, it } from "vitest";
import { isValidCuitCuil } from "@/lib/cuit";

describe("CUIT/CUIL", () => {
  it("acepta un CUIT válido", () => {
    expect(isValidCuitCuil("20-06489752-8")).toBe(true);
    expect(isValidCuitCuil("20064897528")).toBe(true);
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(isValidCuitCuil("20-06489752-1")).toBe(false);
    expect(isValidCuitCuil("20-123")).toBe(false);
  });
});
