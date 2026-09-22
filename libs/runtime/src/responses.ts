import {
  googleAnalyticsConnectSrc,
  googleAnalyticsImgSrc,
  googleAnalyticsScriptSrc,
  httpStatus,
} from "@repo/config";
import { strictTransportSecurity } from "@repo/runtime/security";

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

function documentPolicy(nonce: string, googleAnalytics: boolean = false): string {
  return [
    "default-src 'none'",
    googleAnalytics
      ? `script-src 'nonce-${nonce}' 'strict-dynamic' ${googleAnalyticsScriptSrc.join(" ")}`
      : `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    googleAnalytics
      ? `img-src 'self' data: ${googleAnalyticsImgSrc.join(" ")}`
      : "img-src 'self' data:",
    "font-src 'self'",
    googleAnalytics
      ? `connect-src 'self' ${googleAnalyticsConnectSrc.join(" ")}`
      : "connect-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    ...isolationDirectives,
  ].join("; ");
}

function jsonResponse(value: unknown, status: number = httpStatus.ok): Response {
  return Response.json(value, { headers: privateHeaders, status });
}

function contentSecurityPolicy(
  response: Response,
  nonce: string | undefined,
  googleAnalytics: boolean = false,
): string {
  const rendersDocument = response.headers.get("content-type")?.startsWith("text/html") === true;
  return rendersDocument && nonce !== undefined
    ? documentPolicy(nonce, googleAnalytics)
    : dataPolicy;
}

function secureResponse(
  request: Request,
  response: Response,
  nonce?: string,
  googleAnalytics: boolean = false,
): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("cache-control", "no-store");
  secured.headers.set("x-content-type-options", "nosniff");
  secured.headers.set("referrer-policy", "no-referrer");
  secured.headers.set("x-frame-options", "DENY");
  secured.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set(
    "content-security-policy",
    contentSecurityPolicy(response, nonce, googleAnalytics),
  );
  if (new URL(request.url).protocol === "https:") {
    secured.headers.set("strict-transport-security", strictTransportSecurity);
  }
  return secured;
}

function unindexedResponse(response: Response): Response {
  const unindexed = new Response(response.body, response);
  unindexed.headers.set("x-robots-tag", "noindex, nofollow");
  return unindexed;
}

export { createNonce, jsonResponse, secureResponse, unindexedResponse };
