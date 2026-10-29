import { Array as Arr, Record as Rec, pipe } from "effect";

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

const contentSecurityPolicy = ({
  script,
  style,
}: Readonly<{ script: readonly string[]; style: readonly string[] }>): string =>
  pipe(
    [
      "default-src 'self'",
      pipe(["script-src 'self'", ...script], Arr.join(" ")),
      pipe(["style-src 'self'", ...style], Arr.join(" ")),
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ],
    Arr.join("; "),
  );

const STATIC_PAGE_HEADERS = {
  ...SECURITY_HEADERS,
  "Content-Security-Policy": contentSecurityPolicy({ script: [], style: [] }),
} as const;

const assetHeaders = (pageHeaders: Readonly<Record<string, string>>): string =>
  pipe(
    [
      "/*",
      ...pipe(
        Rec.toEntries(pageHeaders),
        Arr.map(([name, value]) => `  ${name}: ${value}`),
      ),
      "/assets/*",
      `  Cache-Control: ${ASSET_CACHE_CONTROL}`,
      "",
    ],
    Arr.join("\n"),
  );

export { SECURITY_HEADERS, STATIC_PAGE_HEADERS, assetHeaders, contentSecurityPolicy };
