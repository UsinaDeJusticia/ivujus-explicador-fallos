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

  const localMode = ex.mode === "webllm";
  const gpuBlocked = localMode && ex.webgpu && !ex.webgpu.ok;
  const redactionCount = useMemo(
    () => ex.anonymized?.redactions.length ?? 0,
    [ex.anonymized],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10 text-zinc-900 dark:text-zinc-100">
      <header className="space-y-2">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
          IVUJUS · Usina de Justicia
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Asistente de Justicia Humana
        </h1>
        <p className="text-zinc-700 dark:text-zinc-300">
          Subí el PDF de tu fallo y te lo explicamos en palabras simples. Antes
          de enviarlo, quitamos tus datos personales y podés revisar el texto.
        </p>
      </header>

      {gpuBlocked ? (
        <div
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          role="alert"
        >
          <p className="font-semibold">Este modo local no está disponible</p>
          <p className="mt-1">
            {ex.webgpu && !ex.webgpu.ok ? ex.webgpu.message : ""}
          </p>
          <p className="mt-1">
            Elegí el modo en la nube o probá con Chrome o Edge actualizado.
          </p>
        </div>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Cómo generar la explicación
          <select
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            value={ex.modelId}
            disabled={ex.busy}
            onChange={(e) => ex.setModelId(e.target.value)}
          >
            {ex.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.approxDownloadMB ? ` (~${m.approxDownloadMB} MB)` : ""}
              </option>
            ))}
          </select>
        </label>
        {localMode ? (
          <button
            type="button"
            disabled={ex.busy || !!gpuBlocked || ex.ready}
            onClick={() => void ex.loadModel()}
            className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-800/40 disabled:text-white/80 dark:bg-blue-600 dark:disabled:bg-blue-600/40"
          >
            {ex.ready ? "Modo local listo" : "Preparar modo local"}
          </button>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Modo recomendado: explicación en la nube (no hace falta descargar
            nada).
          </p>
        )}
        {ex.loadProgress ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <div className="mb-1 h-2 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full bg-blue-700 transition-all dark:bg-blue-500"
                style={{
                  width: `${Math.round((ex.loadProgress.progress || 0) * 100)}%`,
                }}
              />
            </div>
            {ex.loadProgress.text}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Cargá el PDF de tu fallo
          <input
            type="file"
            accept="application/pdf"
            className="mt-2 block w-full text-sm text-zinc-800 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 dark:text-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100"
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
          <p className="mt-3 text-sm text-red-700 dark:text-red-400" role="alert">
            {ex.error}
          </p>
        ) : null}
      </section>

      {ex.anonymized && !ex.confirmed ? (
        <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Revisá tus datos ({redactionCount} cambios)
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Sacamos datos personales del texto. Revisalo y corregí lo que haga
            falta. Solo se puede enviar este texto ya revisado, nunca el PDF
            original.
          </p>
          {ex.anonymized?.notice ? (
            <p className="text-xs text-violet-900 dark:text-violet-200">
              {ex.anonymized.notice}
            </p>
          ) : null}
          <textarea
            className="h-56 w-full rounded-xl border border-zinc-300 bg-white p-3 font-mono text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <details className="text-xs text-zinc-600 dark:text-zinc-400">
            <summary>Lista de datos reemplazados</summary>
            <textarea
              className="mt-2 h-40 w-full rounded-xl border border-zinc-300 bg-white p-2 font-mono text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              value={lexiconJson}
              onChange={(e) => setLexiconJson(e.target.value)}
            />
          </details>

          {!localMode ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              <p className="font-semibold">Aviso de consentimiento</p>
              <p className="mt-2">
                El texto anonimizado se enviará a un servicio externo de
                inteligencia artificial para generar la explicación. Al
                aceptar, consentís este envío.
              </p>
              <label className="mt-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={ex.consent}
                  onChange={(e) => ex.setConsent(e.target.checked)}
                />
                <span>Acepto el envío del texto anonimizado.</span>
              </label>
            </div>
          ) : null}

          <button
            type="button"
            disabled={ex.busy || (!localMode && !ex.consent)}
            className="rounded-xl bg-violet-800 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-violet-800/40 disabled:text-white/80 dark:bg-violet-600 dark:disabled:bg-violet-600/40"
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
                  className="rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-3 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-500"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            {ex.messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === "assistant"
                    ? "rounded-xl bg-blue-50 px-3 py-2 text-sm text-zinc-900 dark:bg-blue-950 dark:text-zinc-100"
                    : "rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                }
              >
                <p className="mb-1 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
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
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400"
              />
              <button
                type="submit"
                disabled={ex.busy || !input.trim()}
                className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-800/40 disabled:text-white/80 dark:bg-blue-600 dark:disabled:bg-blue-600/40"
              >
                Enviar
              </button>
            </form>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={ex.busy || !ex.lastAssistant}
                onClick={() => void ex.downloadPdf()}
                className="text-sm font-medium text-blue-800 underline disabled:cursor-not-allowed disabled:text-blue-800/50 dark:text-blue-300 dark:disabled:text-blue-300/50"
              >
                Guardar explicación (PDF)
              </button>
              <button
                type="button"
                disabled={ex.busy}
                onClick={() => void ex.clearAll()}
                className="text-sm font-medium text-red-700 underline disabled:cursor-not-allowed disabled:text-red-700/50 dark:text-red-400 dark:disabled:text-red-400/50"
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
