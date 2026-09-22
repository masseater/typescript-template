import { httpStatus } from "@repo/config";
import { strictTransportSecurity } from "@repo/runtime/security";
const nonceBytes = 16;
const isolationDirectives = [
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
] as const;
const dataPolicy = ["default-src 'none'", "form-action 'none'", ...isolationDirectives].join("; ");
const createNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(nonceBytes));
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binary);
};
const privateHeaders = {
  "cache-control": "no-store",
  "content-security-policy": dataPolicy,
  "x-content-type-options": "nosniff",
} as const;
const jsonResponse = (decoded: unknown, httpStatusCode: number = httpStatus.ok): Response => {
  return Response.json(decoded, { headers: privateHeaders, status: httpStatusCode });
};
const documentPolicy = (nonce: string): string => {
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
};
const contentSecurityPolicy = (httpResponse: Response, nonce: string | undefined): string => {
  const rendersDocument =
    httpResponse.headers.get("content-type")?.startsWith("text/html") === true;
  return rendersDocument && nonce !== undefined ? documentPolicy(nonce) : dataPolicy;
};
const secureResponse = (asked: {
  readonly httpRequest: Request;
  readonly httpResponse: Response;
  readonly nonce?: string;
}): Response => {
  const secured = new Response(asked.httpResponse.body, asked.httpResponse);
  secured.headers.set("cache-control", "no-store");
  secured.headers.set("x-content-type-options", "nosniff");
  secured.headers.set("referrer-policy", "no-referrer");
  secured.headers.set("x-frame-options", "DENY");
  secured.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set(
    "content-security-policy",
    contentSecurityPolicy(asked.httpResponse, asked.nonce),
  );
  if (new URL(asked.httpRequest.url).protocol === "https:") {
    secured.headers.set("strict-transport-security", strictTransportSecurity);
  }
  return secured;
};
const unindexedResponse = (httpResponse: Response): Response => {
  const unindexed = new Response(httpResponse.body, httpResponse);
  unindexed.headers.set("x-robots-tag", "noindex, nofollow");
  return unindexed;
};
export { createNonce, jsonResponse, secureResponse, unindexedResponse };
