export type NerEntityType =
  | "PERSON"
  | "LOC"
  | "ORG"
  | "MISC";

export type NerSpan = {
  type: NerEntityType;
  text: string;
  start: number;
  end: number;
  score?: number;
};

export interface NerEngine {
  readonly kind: "rules-only" | "transformers";
  /** true si el motor está listo para anotar. */
  isReady(): boolean;
  load?(onProgress?: (msg: string) => void): Promise<void>;
  annotate(text: string): Promise<NerSpan[]>;
  dispose?(): Promise<void>;
}
