/**
 * Valida CUIT/CUIL argentino (11 dígitos) con dígito verificador.
 * Prefijos habituales: 20, 23, 24, 27 (personas) / 30, 33, 34 (empresas).
 */
export function normalizeCuitDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return digits;
}

export function isValidCuitCuil(raw: string): boolean {
  const digits = normalizeCuitDigits(raw);
  if (!digits) return false;
  const prefix = digits.slice(0, 2);
  if (!["20", "23", "24", "27", "30", "33", "34"].includes(prefix)) {
    return false;
  }
  const nums = digits.split("").map((d) => Number(d));
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += (nums[i] ?? 0) * (multipliers[i] ?? 0);
  }
  const mod = sum % 11;
  const check = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod;
  // When mod===1, AFIP uses special cases for some types; accept 9 or 0 variants loosely:
  if (mod === 1) {
    return nums[10] === 9 || nums[10] === 0;
  }
  return nums[10] === check;
}
