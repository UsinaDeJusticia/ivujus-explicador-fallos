"use client";

import { useMemo, useState } from "react";
import { useExplicador } from "@/hooks/useExplicador";
import type { QuickAction } from "@/lib/prompts";

const ACTIONS: { id: QuickAction; label: string }[] = [
  { id: "resumen", label: "¿Qué es lo más importante?" },
  { id: "pasos", label: "¿Cómo sigue mi caso?" },
  { id: "glosario", label: "Glosario sencillo" },
  { id: "contacto", label: "Necesito hablar con alguien" },
];

export function ExplicadorApp() {
  const ex = useExplicador();
  const [draft, setDraft] = useState("");
  const [lexiconJson, setLexiconJson] = useState("{}");
  const [input, setInput] = useState("");

  const gpuBlocked = ex.webgpu && !ex.webgpu.ok;
  const redactionCount = useMemo(
    () => ex.anonymized?.redactions.length ?? 0,
    [ex.anonymized],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-blue-800">
          IVUJUS · Usina de Justicia
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Asistente de Justicia Humana
        </h1>
        <p className="text-zinc-600">
          Todo corre en tu navegador. El fallo no se sube a ningún servidor de
          IA. Solo se bajan los pesos del modelo (Cache Storage de WebLLM).
        </p>
      </header>

      {gpuBlocked ? (
        <div
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold">WebGPU no disponible</p>
          <p className="mt-1">{ex.webgpu && !ex.webgpu.ok ? ex.webgpu.message : ""}</p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
        <label className="block text-sm font-medium text-zinc-800">
          Modelo local
          <select
            className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            value={ex.modelId}
            disabled={ex.busy || !!gpuBlocked}
            onChange={(e) => ex.setModelId(e.target.value)}
          >
            {ex.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} (~{m.approxDownloadMB} MB)
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={ex.busy || !!gpuBlocked || ex.ready}
          onClick={() => void ex.loadModel()}
          className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {ex.ready ? "Modelo listo" : "Descargar / cargar modelo"}
        </button>
        {ex.loadProgress ? (
          <div className="text-sm text-zinc-600">
            <div className="mb-1 h-2 overflow-hidden rounded bg-zinc-100">
              <div
                className="h-full bg-blue-700 transition-all"
                style={{
                  width: `${Math.round((ex.loadProgress.progress || 0) * 100)}%`,
                }}
              />
            </div>
            {ex.loadProgress.text}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-zinc-800">
          Cargá el documento PDF (solo en memoria)
          <input
            type="file"
            accept="application/pdf"
            className="mt-2 block w-full text-sm"
            disabled={ex.busy || !!gpuBlocked}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void ex.ingestFile(f).then((result) => {
                if (!result) return;
                setDraft(result.text);
                setLexiconJson(JSON.stringify(result.lexicon, null, 2));
              });
            }}
          />
        </label>
        {ex.error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {ex.error}
          </p>
        ) : null}
      </section>

      {ex.anonymized && !ex.confirmed ? (
        <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <h2 className="text-lg font-semibold text-zinc-900">
            Revisá la reducción de datos ({redactionCount} hallazgos)
          </h2>
          <p className="text-sm text-zinc-700">
            Esto es una <strong>reducción de datos personales</strong>, no una
            anonimización total. Antes de mandar el texto al modelo local,
            corregí placeholders o devolvé datos si se tapó de más. Nada se
            guarda en disco.
          </p>
          {ex.anonymized?.notice ? (
            <p className="text-xs text-violet-900">{ex.anonymized.notice}</p>
          ) : null}
          <textarea
            className="h-56 w-full rounded-xl border border-zinc-300 bg-white p-3 font-mono text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <details className="text-xs text-zinc-600">
            <summary>Léxico (placeholder → original)</summary>
            <textarea
              className="mt-2 h-40 w-full rounded-xl border border-zinc-300 bg-white p-2 font-mono"
              value={lexiconJson}
              onChange={(e) => setLexiconJson(e.target.value)}
            />
          </details>
          <button
            type="button"
            disabled={ex.busy}
            className="rounded-xl bg-violet-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              let lexicon: Record<string, string> = {};
              try {
                lexicon = JSON.parse(lexiconJson) as Record<string, string>;
              } catch {
                lexicon = ex.anonymized?.lexicon ?? {};
              }
              void ex.confirmAnonymized(draft, lexicon);
            }}
          >
            Confirmar y continuar
          </button>
        </section>
      ) : null}

      {ex.confirmed ? (
        <>
          <section className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={ex.busy}
                  onClick={() => void ex.ask({ action: action.id })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-sm font-medium hover:bg-zinc-100 disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
            {ex.messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === "assistant"
                    ? "rounded-xl bg-blue-50 px-3 py-2 text-sm"
                    : "rounded-xl bg-zinc-100 px-3 py-2 text-sm"
                }
              >
                <p className="mb-1 text-xs font-semibold uppercase text-zinc-500">
                  {m.role === "assistant" ? "IVUJUS" : "Vos"}
                </p>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!input.trim()) return;
                void ex.ask({ action: "custom", prompt: input.trim() });
                setInput("");
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={ex.busy}
                placeholder="Escribí tu duda…"
                className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={ex.busy || !input.trim()}
                className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Enviar
              </button>
            </form>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={ex.busy || !ex.lastAssistant}
                onClick={() => void ex.downloadPdf()}
                className="text-sm font-medium text-blue-800 underline disabled:opacity-50"
              >
                Guardar explicación (PDF)
              </button>
              <button
                type="button"
                disabled={ex.busy}
                onClick={() => void ex.clearAll()}
                className="text-sm font-medium text-red-700 underline disabled:opacity-50"
              >
                Borrar todo
              </button>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
