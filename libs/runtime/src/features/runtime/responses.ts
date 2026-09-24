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
const documentPolicy = (nonce: string, googleAnalytics = false): string => {
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
};
const contentSecurityPolicy = (
  asked: Readonly<{
    httpResponse: Response;
    nonce: string | undefined;
    googleAnalytics: boolean;
  }>,
): string => {
  const rendersDocument =
    asked.httpResponse.headers.get("content-type")?.startsWith("text/html") === true;
  return rendersDocument && asked.nonce !== undefined
    ? documentPolicy(asked.nonce, asked.googleAnalytics)
    : dataPolicy;
};
const secureResponse = (asked: {
  readonly httpRequest: Request;
  readonly httpResponse: Response;
  readonly nonce?: string;
  readonly googleAnalytics?: boolean;
}): Response => {
  const secured = new Response(asked.httpResponse.body, asked.httpResponse);
  secured.headers.set("cache-control", "no-store");
  secured.headers.set("x-content-type-options", "nosniff");
  secured.headers.set("referrer-policy", "no-referrer");
  secured.headers.set("x-frame-options", "DENY");
  secured.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  secured.headers.set(
    "content-security-policy",
    contentSecurityPolicy({
      googleAnalytics: asked.googleAnalytics ?? false,
      httpResponse: asked.httpResponse,
      nonce: asked.nonce,
    }),
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
