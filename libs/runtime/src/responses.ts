import { strictTransportSecurity } from "@repo/config/security";
import { httpStatus } from "@repo/observability";

const nonceBytes = 16;

const isolationDirectives = [
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
] as const;
const dataPolicy = ["default-src 'none'", "form-action 'none'", ...isolationDirectives].join("; ");

const privateHeaders = {
  "cache-control": "no-store",
  "content-security-policy": dataPolicy,
  "x-content-type-options": "nosniff",
} as const;

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(nonceBytes));
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binary);
}

function documentPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    ...isolationDirectives,
  ].join("; ");
}

function jsonResponse(value: unknown, status: number = httpStatus.ok): Response {
  return Response.json(value, { headers: privateHeaders, status });
}

function contentSecurityPolicy(response: Response, nonce: string | undefined): string {
  const rendersDocument = response.headers.get("content-type")?.startsWith("text/html") === true;
  return rendersDocument && nonce !== undefined ? documentPolicy(nonce) : dataPolicy;
}

function secureResponse(request: Request, response: Response, nonce?: string): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy", contentSecurityPolicy(response, nonce));
  if (new URL(request.url).protocol === "https:") {
    headers.set("strict-transport-security", strictTransportSecurity);
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export { createNonce, jsonResponse, secureResponse };
