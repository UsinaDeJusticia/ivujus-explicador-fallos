"use client";

import { useMemo, useState } from "react";

type ChatTurn = { role: "user" | "assistant"; content: string };

const ACTIONS: { id: "resumen" | "pasos" | "glosario" | "contacto"; label: string }[] =
  [
    { id: "resumen", label: "¿Qué es lo más importante?" },
    { id: "pasos", label: "¿Cómo sigue mi caso?" },
    { id: "glosario", label: "Glosario sencillo" },
    { id: "contacto", label: "Necesito hablar con alguien" },
  ];

export default function HomePage() {
  const [pdfText, setPdfText] = useState("");
  const [welcome, setWelcome] = useState("");
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [lastAssistant, setLastAssistant] = useState("");

  const canChat = useMemo(() => Boolean(pdfText), [pdfText]);

  async function onUpload(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessages([]);
    setWelcome("");
    setLastAssistant("");
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/explicar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo leer el PDF");
      setPdfText(data.text);
      setWelcome(data.welcome);
      setMessages([{ role: "assistant", content: data.welcome }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el PDF");
    } finally {
      setBusy(false);
    }
  }

  async function runChat(opts: {
    action?: "resumen" | "pasos" | "glosario" | "contacto" | "custom";
    prompt?: string;
  }) {
    if (!pdfText) return;
    setBusy(true);
    setError(null);
    const userText =
      opts.prompt ||
      ACTIONS.find((a) => a.id === opts.action)?.label ||
      "Consulta";
    setMessages((m) => [...m, { role: "user", content: userText }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfText,
          messages,
          action: opts.action,
          prompt: opts.prompt,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error en el chat");
      }

      if (contentType.includes("application/json")) {
        const data = await res.json();
        const content = data.content as string;
        setLastAssistant(content);
        setMessages((m) => [...m, { role: "assistant", content }]);
      } else {
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Sin stream de respuesta");
        const decoder = new TextDecoder();
        let content = "";
        setMessages((m) => [...m, { role: "assistant", content: "" }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          const snapshot = content;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: snapshot };
            return copy;
          });
        }
        setLastAssistant(content);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en el chat");
    } finally {
      setBusy(false);
      setInput("");
    }
  }

  async function downloadPdf() {
    const text = lastAssistant || welcome;
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo generar el PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "guia_ivujus.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al bajar el PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium text-blue-800">IVUJUS · Usina de Justicia</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Asistente de Justicia Humana
        </h1>
        <p className="text-zinc-600">
          Te ayudamos a entender tu proceso sin tecnicismos. Esta UI mínima usa
          la misma API que puede consumir otra página.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-zinc-800">
          Cargá el documento PDF
          <input
            type="file"
            accept="application/pdf"
            className="mt-2 block w-full text-sm"
            disabled={busy}
            onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {busy ? <p className="mt-3 text-sm text-zinc-500">Procesando…</p> : null}
      </section>

      {canChat ? (
        <>
          <section className="space-y-3">
            <p className="text-sm text-zinc-600">
              Tocá una opción; no hay preguntas tontas:
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void runChat({ action: action.id })}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === "assistant"
                    ? "rounded-xl bg-blue-50 px-3 py-2 text-sm text-zinc-900"
                    : "rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-800"
                }
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
                void runChat({ prompt: input.trim(), action: "custom" });
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                placeholder="Escribí tu duda…"
                className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Enviar
              </button>
            </form>

            <button
              type="button"
              disabled={busy || !(lastAssistant || welcome)}
              onClick={() => void downloadPdf()}
              className="text-sm font-medium text-blue-800 underline disabled:opacity-50"
            >
              Guardar explicación (PDF)
            </button>
          </section>
        </>
      ) : null}
    </main>
  );
}
