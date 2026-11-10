import { getAllowedOrigins } from "./config";

export function corsHeaders(requestOrigin: string | null): HeadersInit {
  const allowed = getAllowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (allowed.length === 0) return headers;
  if (requestOrigin && allowed.includes(requestOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  } else if (allowed.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

export function withCors(response: Response, request: Request): Response {
  const extra = corsHeaders(request.headers.get("origin"));
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function preflight(request: Request): Response {
  return withCors(new Response(null, { status: 204 }), request);
}

export function originAllowed(request: Request): boolean {
  const allowed = getAllowedOrigins();
  if (allowed.length === 0 || allowed.includes("*")) return true;
  const origin = request.headers.get("origin");
  // Same-origin / no Origin header (navegación directa o server-side)
  if (!origin) return true;
  return allowed.includes(origin);
}
