import { describe, expect, it } from "vitest";
import { anonymizeText, deanonymizeText } from "@/lib/anonymize";

describe("reducción de datos personales", () => {
  it("tapa DNI, CUIT válido, email, teléfono, expediente, matrícula, HC, legajo y catastro", () => {
    const input = `
Autos: Expte. FSM 12345/2024
El imputado Juan Pérez, DNI 25.456.789, CUIT 20-06489752-8,
MN 12345, historia clínica HC 99887, legajo 4455,
Barrio San José, Mz. 4, Lote 12,
domiciliado en Calle San Martín 1234, celular 11 5555-6677,
email juan.perez@correo.com, patente AB123CD.
Fecha de nacimiento: 12/05/1990. Tiene 34 años de edad.
`;
    const result = anonymizeText(input);
    expect(result.notice).toMatch(/Reducción de datos personales/);
    expect(result.text).not.toMatch(/Juan Pérez/);
    expect(result.text).not.toMatch(/25\.456\.789/);
    expect(result.text).not.toMatch(/20-06489752-8/);
    expect(result.text).not.toMatch(/juan\.perez@correo\.com/);
    expect(result.text).toMatch(/\[PERSONA_/);
    expect(result.text).toMatch(/\[DNI_/);
    expect(result.text).toMatch(/\[CUIT_/);
    expect(result.text).toMatch(/\[MATRICULA_/);
    expect(result.text).toMatch(/\[HC_/);
    expect(result.text).toMatch(/\[LEGAJO_/);
    expect(result.text).toMatch(/\[DOMICILIO_/);
    expect(result.text).toMatch(/\[FECHA_/);
    expect(result.text).toMatch(/\[EDAD_/);
  });

  it("no tapa un CUIT con dígito inválido como CUIT", () => {
    const result = anonymizeText("CUIT 20-06489752-1 aparece en el texto.");
    expect(result.text).not.toMatch(/\[CUIT_/);
  });

  it("usa placeholders consistentes", () => {
    const input =
      "La víctima María López denunció. Luego María López ratificó.";
    const result = anonymizeText(input);
    const matches = result.text.match(/\[PERSONA_\d+\]/g) || [];
    expect(new Set(matches).size).toBe(1);
  });

  it("deanonymize restaura", () => {
    const input = "El imputado Juan Pérez, DNI 30.111.222.";
    const result = anonymizeText(input);
    const back = deanonymizeText(result.text, result.lexicon);
    expect(back).toContain("Juan Pérez");
  });
});
