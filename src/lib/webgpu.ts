export type WebGpuStatus =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "no-adapter"; message: string };

type GpuNavigator = Navigator & {
  gpu?: {
    requestAdapter: () => Promise<unknown | null>;
  };
};

export async function checkWebGpu(): Promise<WebGpuStatus> {
  if (typeof navigator === "undefined") {
    return {
      ok: false,
      reason: "unsupported",
      message:
        "Este entorno no tiene WebGPU. Usá Chrome/Edge actualizados en una PC con GPU compatible. No se envía nada a ningún servidor.",
    };
  }
  const nav = navigator as GpuNavigator;
  if (!nav.gpu) {
    return {
      ok: false,
      reason: "unsupported",
      message:
        "Este navegador no tiene WebGPU. Usá Chrome/Edge actualizados (o Firefox Nightly con WebGPU) en una PC con GPU compatible. No se envía nada a ningún servidor.",
    };
  }
  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return {
        ok: false,
        reason: "no-adapter",
        message:
          "WebGPU está presente pero no hay adaptador disponible (drivers, GPU bloqueada o modo software). No se inicia el modelo ni se envía texto a ningún lado.",
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "no-adapter",
      message:
        "No se pudo inicializar WebGPU. Revisá drivers y permisos. No se envía nada a ningún servidor.",
    };
  }
}
