import { checkRateLimit } from "./rate-limit";
import { withCors, preflight } from "./cors";

export function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export function json(
  request: Request,
  body: unknown,
  init: ResponseInit = {},
): Response {
  const response = Response.json(body, init);
  return withCors(response, request);
}

export function handleOptions(request: Request): Response {
  return preflight(request);
}

export function enforceRateLimit(request: Request): Response | null {
  const result = checkRateLimit(clientIp(request));
  if (result.ok) return null;
  return json(
    request,
    { error: "Demasiadas solicitudes. Probá de nuevo en un momento." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    },
  );
}
