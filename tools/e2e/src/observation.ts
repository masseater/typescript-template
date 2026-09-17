import { Effect, Option, Schema } from "effect";
import { ensure, fail, object, fetchResponse, string } from "./support.ts";

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
              const secret = URL.parse(item)?.searchParams.get("secret");
              if (secret) secrets.add(secret);
            }
          }
        }
      } else collectSecrets(entry, secrets);
    }
  }
}

export const assertPrivate = Effect.fn("assertPrivate")(function* (
  data: unknown,
  secrets: readonly string[],
) {
  const text = JSON.stringify(data);
  for (const secret of secrets) {
    if (!secret) continue;
    const variants = [secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)];
    yield* ensure(!variants.some((variant) => text.includes(variant)), "E2E_TELEMETRY_PII_LEAK");
  }
});

export const explorerQuery = Effect.fn("explorerQuery")(function* (
  origin: string,
  sql: string,
  params: readonly (string | number)[],
) {
  const response = yield* fetchResponse(
    `${origin}/cdn-cgi/local/explorer/api/local/observability/query`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
      timeout: 10_000,
      redirect: "error",
    },
  );
  yield* ensure(response.ok, `E2E_LOCAL_EXPLORER_QUERY_FAILED_${response.status}`);
  const body = yield* object(yield* Effect.tryPromise((): Promise<unknown> => response.json()));
  yield* ensure(body["success"] === true, "E2E_LOCAL_EXPLORER_QUERY_FAILED");
  const result = yield* object(body["result"]);
  const columns = result["columns"];
  const rows = result["rows"];
  if (!Array.isArray(columns) || !Array.isArray(rows))
    return yield* fail("E2E_LOCAL_EXPLORER_RESULT_INVALID");
  return yield* Effect.forEach(rows, (row: unknown) =>
    Effect.gen(function* () {
      if (!Array.isArray(row)) return yield* fail("E2E_LOCAL_EXPLORER_RESULT_INVALID");
      return Object.fromEntries(
        yield* Effect.forEach(columns, (column: unknown, index) =>
          Effect.map(string(column), (name) => [name, row[index]] as const),
        ),
      );
    }),
  );
});

const decodeArguments = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Array(Schema.Unknown)),
);
const decodeEvent = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
);

export function structuredEvent(message: unknown): Record<string, unknown> | undefined {
  return decodeArguments(message).pipe(
    Option.flatMap(([first]) => (typeof first === "string" ? decodeEvent(first) : Option.none())),
    Option.getOrUndefined,
  );
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
