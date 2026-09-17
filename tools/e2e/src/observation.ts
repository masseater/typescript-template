import { ensure, object, string } from "./support.ts";

export type ObservedRequest = {
  requestId: string;
  traceparent: string;
  clientTraceparent?: string;
  path: string;
  method: string;
  status: number;
  kind: string;
};

export function header(headers: Record<string, unknown>, name: string): string | undefined {
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  return typeof value === "string" ? value : undefined;
}

export function collectSecrets(value: unknown, secrets: Set<string>): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectSecrets(entry, secrets);
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (
        /^(?:password|newPassword|currentPassword|email|profile|token|secret|code|backupCode|backupCodes|totpURI)$/i.test(
          key,
        )
      ) {
        for (const item of Array.isArray(entry) ? entry : [entry]) {
          if (typeof item === "string" && item.length > 0) {
            secrets.add(item);
            if (item.startsWith("otpauth:")) {
              const secret = new URL(item).searchParams.get("secret");
              if (secret) secrets.add(secret);
            }
          }
        }
      } else collectSecrets(entry, secrets);
    }
  }
}

export function assertPrivate(data: unknown, secrets: readonly string[]): void {
  const text = JSON.stringify(data);
  for (const secret of secrets) {
    if (!secret) continue;
    const variants = [secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)];
    const leaked = /^\d+$/.test(secret)
      ? new RegExp(`(?<!\\d)${secret}(?!\\d)`).test(text)
      : variants.some((variant) => text.includes(variant));
    ensure(!leaked, "E2E_TELEMETRY_PII_LEAK");
  }
}

export async function explorerQuery(
  origin: string,
  sql: string,
  params: readonly (string | number)[],
): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${origin}/cdn-cgi/local/explorer/api/local/observability/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sql, params }),
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  ensure(response.ok, `E2E_LOCAL_EXPLORER_QUERY_FAILED_${response.status}`);
  const body = object(await response.json());
  ensure(body["success"] === true, "E2E_LOCAL_EXPLORER_QUERY_FAILED");
  const result = object(body["result"]);
  const columns = result["columns"];
  const rows = result["rows"];
  ensure(Array.isArray(columns) && Array.isArray(rows), "E2E_LOCAL_EXPLORER_RESULT_INVALID");
  return rows.map((row: unknown) => {
    ensure(Array.isArray(row), "E2E_LOCAL_EXPLORER_RESULT_INVALID");
    return Object.fromEntries(
      columns.map((column: unknown, index) => [string(column), row[index]]),
    );
  });
}

export function structuredEvent(message: unknown): Record<string, unknown> | undefined {
  if (typeof message !== "string") return undefined;
  try {
    const args: unknown = JSON.parse(message);
    const first: unknown = Array.isArray(args) ? args[0] : undefined;
    if (typeof first !== "string") return undefined;
    const parsed: unknown = JSON.parse(first);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? object(parsed)
      : undefined;
  } catch {
    return undefined;
  }
}

export function relatedSpans(
  spans: readonly Record<string, unknown>[],
  events: readonly (Record<string, unknown> | undefined)[],
  request: ObservedRequest,
  service: "user" | "admin" | "wiki",
) {
  if (request.clientTraceparent) {
    const [, clientTrace, clientSpan] = request.clientTraceparent.split("-");
    const [, serverTrace] = request.traceparent.split("-");
    if (serverTrace !== clientTrace) return false;
    if (
      !events.some(
        (event) =>
          event?.["event"] === "http.client.request" &&
          event["service"] === `${service}-browser` &&
          event["trace_id"] === clientTrace &&
          event["span_id"] === clientSpan &&
          event["request_id"] === request.requestId,
      )
    )
      return false;
  } else if (request.method !== "GET" && request.method !== "HEAD") return false;
  const successful = request.status >= 200 && request.status < 400;
  if (
    successful &&
    /^\/api\/(?:auth\/|profile$|users$|session$|verify-email$)/.test(request.path) &&
    !spans.some((span) => String(span["name"]).startsWith("d1_"))
  )
    return false;
  if (
    successful &&
    request.path === "/api/auth/sign-up/email" &&
    !spans.some(
      (span) => span["name"] === "fetch" && String(span["attributes"]).includes("/api/v1/send"),
    )
  )
    return false;
  return true;
}
