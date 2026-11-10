import { isValidCuitCuil } from "./cuit";
import type { NerEngine, NerSpan } from "./ner/types";
import { RulesOnlyNer } from "./ner/rules-only";

export type EntityKind =
  | "PERSONA"
  | "DNI"
  | "CUIT"
  | "TELEFONO"
  | "EMAIL"
  | "DOMICILIO"
  | "EXPEDIENTE"
  | "FECHA_NAC"
  | "PATENTE"
  | "MATRICULA"
  | "HC"
  | "LEGAJO"
  | "ORGANIZACION"
  | "LUGAR"
  | "FECHA"
  | "EDAD";

export type Redaction = {
  kind: EntityKind;
  placeholder: string;
  original: string;
  start: number;
  end: number;
};

export type AnonymizeResult = {
  text: string;
  redactions: Redaction[];
  lexicon: Record<string, string>;
  /** Aviso de producto: es reducción, no anonimización total. */
  notice: string;
};

type Counter = Partial<Record<EntityKind, number>>;

type Hit = { start: number; end: number; kind: EntityKind; original: string; replacement?: string };

const PERSON_LEAD_STOP = new Set([
  "luego",
  "además",
  "ademas",
  "también",
  "tambien",
  "según",
  "segun",
  "conforme",
  "autos",
  "vistos",
  "considerando",
]);

function normalizePersonKey(original: string): string {
  const stripped = original
    .replace(
      /^(?:(?:el|la)\s+)?(?:imputad[oa]|acusad[oa]|v[ií]ctima|denunciante|demandad[oa]|actor(?:a)?|testigo|menor)\s+/i,
      "",
    )
    .replace(/^(?:Sr\.?|Sra\.?|Srta\.?|Dr\.?|Dra\.?)\s+/i, "")
    .trim();
  let caps: string[] = stripped.match(/[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+/g) ?? [];
  while (caps.length && PERSON_LEAD_STOP.has(caps[0]!.toLowerCase())) {
    caps = caps.slice(1);
  }
  return (caps.length ? caps.join(" ") : stripped).toLowerCase();
}


const NOTICE =
  "Reducción de datos personales (heurística + opcional NER). No es anonimización total: revisá y corregí antes de continuar.";

function nextId(counters: Counter, kind: EntityKind): string {
  counters[kind] = (counters[kind] || 0) + 1;
  return `[${kind}_${counters[kind]}]`;
}

function pushAll(
  input: string,
  hits: Hit[],
  re: RegExp,
  kind: EntityKind,
  mapOriginal?: (match: string, groups: RegExpExecArray) => string | null,
  mapReplacement?: (match: string, groups: RegExpExecArray) => string | undefined,
) {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(input)) !== null) {
    if (mapOriginal) {
      const ok = mapOriginal(m[0], m);
      if (ok === null) continue;
    }
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      kind,
      original: m[0],
      replacement: mapReplacement?.(m[0], m),
    });
  }
}

function monthYearFromDate(raw: string): string | undefined {
  const m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return undefined;
  const month = m[2]!.padStart(2, "0");
  let year = m[3]!;
  if (year.length === 2) year = Number(year) > 50 ? `19${year}` : `20${year}`;
  return `[FECHA_${month}/${year}]`;
}

function ageRange(raw: string): string | undefined {
  const m = raw.match(/(\d{1,3})/);
  if (!m) return undefined;
  const age = Number(m[1]);
  if (!Number.isFinite(age) || age < 0 || age > 120) return undefined;
  const start = Math.floor(age / 5) * 5;
  return `[EDAD_${start}-${start + 4}]`;
}

function nerToHits(spans: NerSpan[]): Hit[] {
  const out: Hit[] = [];
  for (const s of spans) {
    let kind: EntityKind = "PERSONA";
    if (s.type === "LOC") kind = "LUGAR";
    else if (s.type === "ORG") kind = "ORGANIZACION";
    else if (s.type === "PERSON") kind = "PERSONA";
    else continue;
    out.push({
      start: s.start,
      end: s.end,
      kind,
      original: s.text,
    });
  }
  return out;
}

export type AnonymizeOptions = {
  ner?: NerEngine;
};

/**
 * Reduce datos personales en el texto (reglas AR + NER opcional).
 * Siempre devolver para revisión humana antes del modelo.
 */
export async function anonymizeTextAsync(
  input: string,
  options: AnonymizeOptions = {},
): Promise<AnonymizeResult> {
  const ner = options.ner ?? new RulesOnlyNer();
  let nerSpans: NerSpan[] = [];
  if (ner.isReady()) {
    try {
      nerSpans = await ner.annotate(input);
    } catch {
      nerSpans = [];
    }
  }
  return anonymizeText(input, nerSpans);
}

/** Versión síncrona (solo reglas + spans NER ya calculados). */
export function anonymizeText(
  input: string,
  nerSpans: NerSpan[] = [],
): AnonymizeResult {
  const counters: Counter = {};
  const lexicon: Record<string, string> = {};
  const redactions: Redaction[] = [];
  const hits: Hit[] = [...nerToHits(nerSpans)];

  // Emails
  pushAll(input, hits, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "EMAIL");

  // CUIT/CUIL con dígito verificador
  pushAll(
    input,
    hits,
    /\b(?:CUIT|CUIL)\s*:?\s*\d{2}[-\s]?\d{7,8}[-\s]?\d\b/gi,
    "CUIT",
    (match) => (isValidCuitCuil(match) ? match : null),
  );
  pushAll(
    input,
    hits,
    /\b(?:20|23|24|27|30|33|34)[-\s]?\d{7,8}[-\s]?\d\b/g,
    "CUIT",
    (match) => (isValidCuitCuil(match) ? match : null),
  );

  // DNI
  pushAll(
    input,
    hits,
    /\b(?:D\.?N\.?I\.?|documento)\s*:?\s*\d{1,2}[.\s]?\d{3}[.\s]?\d{3}\b/gi,
    "DNI",
  );
  pushAll(input, hits, /\b\d{1,2}[.\s]\d{3}[.\s]\d{3}\b/g, "DNI");

  // Matrículas MN / MP
  pushAll(
    input,
    hits,
    /\b(?:M\.?\s*N\.?|MN|M\.?\s*P\.?|MP)\s*(?:N[°ºo\.]*\s*)?\d{2,7}\b/gi,
    "MATRICULA",
  );
  pushAll(
    input,
    hits,
    /\bmatr[ií]cula\s*(?:nacional|provincial|mn|mp)?\s*(?:N[°ºo\.]*\s*)?\d{2,7}\b/gi,
    "MATRICULA",
  );

  // Historia clínica / HC / H.C.
  pushAll(
    input,
    hits,
    /\b(?:H\.?\s*C\.?|historia\s+cl[ií]nica)\s*(?:N[°ºo\.]*\s*)?[\w./-]{3,}\b/gi,
    "HC",
  );

  // Legajo
  pushAll(
    input,
    hits,
    /\blegajo\s*(?:N[°ºo\.]*\s*)?[\w./-]{2,}\b/gi,
    "LEGAJO",
  );

  // Domicilio catastral: B° / Barrio, Mz / Manzana, Lote
  pushAll(
    input,
    hits,
    /\b(?:B°|Bto\.?|Barrio)\s+[A-ZÁÉÍÓÚÑ0-9][\wÁÉÍÓÚÑáéíóúñ.\s-]{1,40}/gi,
    "DOMICILIO",
  );
  pushAll(
    input,
    hits,
    /\b(?:Mz\.?|Manzana)\s*\d{1,4}\b(?:\s*,?\s*(?:Lt\.?|Lote)\s*\d{1,4})?/gi,
    "DOMICILIO",
  );
  pushAll(
    input,
    hits,
    /\b(?:Lt\.?|Lote)\s*\d{1,4}\b/gi,
    "DOMICILIO",
  );

  // Teléfonos AR
  pushAll(
    input,
    hits,
    /\b(?:\+?54\s*)?(?:9\s*)?(?:11|[2-9]\d{2,3})[\s-]?\d{3,4}[\s-]?\d{4}\b/g,
    "TELEFONO",
  );

  // Expedientes / causas
  pushAll(
    input,
    hits,
    /\b(?:Expte?\.?|Expediente|Causa|FSM|CFP|CCC|CNCA)\s*(?:N[°ºo\.]*\s*)?[\d./-]{4,}\b/gi,
    "EXPEDIENTE",
  );
  pushAll(input, hits, /\b\d{1,6}\/\d{2,4}(?:[-\/]\d{1,4})?\b/g, "EXPEDIENTE");

  // Fechas de nacimiento → cuasi id mes/año via replacement placeholder kind FECHA_NAC
  pushAll(
    input,
    hits,
    /\b(?:fecha\s+de\s+nacimiento|nacid[oa]\s+el|f\.?\s*de\s*n\.?)\s*:?\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/gi,
    "FECHA_NAC",
    undefined,
    (match) => monthYearFromDate(match) ?? undefined,
  );

  // Otras fechas → mes/año (cuasi-identificador)
  pushAll(
    input,
    hits,
    /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g,
    "FECHA",
    undefined,
    (match) => monthYearFromDate(match) ?? undefined,
  );

  // Edades → rangos
  pushAll(
    input,
    hits,
    /\b(?:edad(?:\s+de)?|de)\s+(\d{1,3})\s*a[nñ]os\b/gi,
    "EDAD",
    undefined,
    (match) => ageRange(match) ?? undefined,
  );
  pushAll(
    input,
    hits,
    /\b(\d{1,3})\s*a[nñ]os\s+de\s+edad\b/gi,
    "EDAD",
    undefined,
    (match) => ageRange(match) ?? undefined,
  );

  // Patentes
  pushAll(input, hits, /\b[A-Z]{3}\d{3}\b/g, "PATENTE");
  pushAll(input, hits, /\b[A-Z]{2}\d{3}[A-Z]{2}\b/g, "PATENTE");

  // Domicilios calle/av
  pushAll(
    input,
    hits,
    /\b(?:calle|av(?:da|enida)?\.?|pasaje|pje\.?|ruta)\s+[A-ZÁÉÍÓÚÑ0-9][\wÁÉÍÓÚÑáéíóúñ.\s]{3,40}?\s+(?:n[°ºo\.]*\s*)?\d{1,5}\b/gi,
    "DOMICILIO",
  );

  // Personas por rol / tratamiento
  pushAll(
    input,
    hits,
    /\b(?:(?:[Ee]l|[Ll]a)\s+)?(?:imputad[oa]|acusad[oa]|v[ií]ctima|denunciante|demandad[oa]|actor(?:a)?|testigo|menor)\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){0,3}/g,
    "PERSONA",
  );
  pushAll(
    input,
    hits,
    /\b(?:Sr\.?|Sra\.?|Srta\.?|Dr\.?|Dra\.?)\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,3}/g,
    "PERSONA",
  );
  pushAll(
    input,
    hits,
    /\b[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,3}\b/g,
    "PERSONA",
  );

  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const selected: Hit[] = [];
  let cursor = 0;
  const stop = new Set([
    "Tribunal",
    "Juzgado",
    "Sala",
    "Corte",
    "Poder",
    "Judicial",
    "Nación",
    "Nacion",
    "Provincia",
    "Buenos",
    "Aires",
    "Fiscalía",
    "Fiscalia",
    "Defensoría",
    "Defensoria",
    "Código",
    "Codigo",
    "Artículo",
    "Articulo",
    "Resolución",
    "Resolucion",
    "Sentencia",
    "Autos",
    "Vistos",
    "Considerando",
    "Usina",
    "Justicia",
    "IVUJUS",
    "Ministerio",
    "Público",
    "Publico",
    "Luego",
    "Además",
    "Ademas",
    "También",
    "Tambien",
    "Según",
    "Segun",
    "Conforme",
  ]);

  for (const hit of hits) {
    if (hit.start < cursor) continue;
    if (hit.kind === "PERSONA" || hit.kind === "LUGAR" || hit.kind === "ORGANIZACION") {
      const tokens = hit.original.split(/\s+/);
      if (tokens.every((t) => stop.has(t))) continue;
      if (tokens.length === 1 && stop.has(tokens[0]!)) continue;
    }
    selected.push(hit);
    cursor = hit.end;
  }

  const seen = new Map<string, string>();
  let out = "";
  let i = 0;
  for (const hit of selected) {
    out += input.slice(i, hit.start);
    const identity =
      hit.kind === "PERSONA"
        ? normalizePersonKey(hit.original)
        : hit.original;
    const key = `${hit.kind}::${identity}`;
    let ph = seen.get(key);
    if (!ph) {
      ph = hit.replacement ?? nextId(counters, hit.kind);
      if (hit.replacement) {
        seen.set(key, hit.replacement);
        ph = hit.replacement;
      } else {
        seen.set(key, ph);
      }
      lexicon[ph] = hit.original;
    }
    redactions.push({
      kind: hit.kind,
      placeholder: ph,
      original: hit.original,
      start: hit.start,
      end: hit.end,
    });
    out += ph;
    i = hit.end;
  }
  out += input.slice(i);

  return { text: out, redactions, lexicon, notice: NOTICE };
}

export function deanonymizeText(
  text: string,
  lexicon: Record<string, string>,
): string {
  let out = text;
  const keys = Object.keys(lexicon).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const value = lexicon[key];
    if (!value) continue;
    out = out.split(key).join(value);
  }
  return out;
}

export function applyManualOverrides(
  result: AnonymizeResult,
  overrides: { placeholder: string; original: string }[],
): AnonymizeResult {
  const lexicon = { ...result.lexicon };
  let text = result.text;
  for (const o of overrides) {
    if (!o.placeholder.startsWith("[")) continue;
    text = text.split(o.placeholder).join(o.original);
    delete lexicon[o.placeholder];
  }
  const redactions = result.redactions.filter(
    (r) => lexicon[r.placeholder] !== undefined,
  );
  return { text, redactions, lexicon, notice: result.notice };
}
