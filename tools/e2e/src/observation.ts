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
    ensure(!variants.some((variant) => text.includes(variant)), "E2E_TELEMETRY_PII_LEAK");
  }
}

export type ObservedSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  service: string;
  requestId?: string;
};

function id(value: unknown, bytes: number): string {
  const raw = string(value);
  if (new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(raw)) return raw;
  const decoded = Buffer.from(raw, "base64");
  ensure(decoded.length === bytes, "E2E_TRACE_ID_ENCODING_INVALID");
  return decoded.toString("hex");
}

function attribute(input: unknown, name: string): string | undefined {
  if (!Array.isArray(input)) return undefined;
  const found: unknown = input.find((entry: unknown) => object(entry)["key"] === name);
  if (!found) return undefined;
  const value = object(object(found)["value"])["stringValue"];
  return typeof value === "string" ? value : undefined;
}

export function traceSpans(input: unknown): ObservedSpan[] {
  const root = object(input);
  const resources = root["batches"] ?? root["resourceSpans"];
  ensure(Array.isArray(resources), "E2E_TRACE_RESOURCES_MISSING");
  const output: ObservedSpan[] = [];
  for (const raw of resources) {
    const resource = object(raw);
    const service = attribute(object(resource["resource"])["attributes"], "service.name");
    ensure(service, "E2E_TRACE_SERVICE_MISSING");
    const scopes = resource["scopeSpans"] ?? resource["instrumentationLibrarySpans"];
    ensure(Array.isArray(scopes), "E2E_TRACE_SCOPES_MISSING");
    for (const scope of scopes) {
      const spans = object(scope)["spans"];
      ensure(Array.isArray(spans), "E2E_TRACE_SPANS_MISSING");
      for (const value of spans) {
        const span = object(value);
        const parent = span["parentSpanId"];
        const requestId = attribute(span["attributes"], "request.id");
        output.push({
          traceId: id(span["traceId"], 16),
          spanId: id(span["spanId"], 8),
          ...(typeof parent === "string" && parent ? { parentSpanId: id(parent, 8) } : {}),
          name: string(span["name"]),
          service,
          ...(requestId ? { requestId } : {}),
        });
      }
    }
  }
  return output;
}

export function relatedSpans(
  spans: ObservedSpan[],
  request: ObservedRequest,
  service: "user" | "admin",
) {
  const [, traceId, spanId] = request.traceparent.split("-");
  const server = spans.find(
    (span) =>
      span.service === `${service}-server` &&
      span.traceId === traceId &&
      span.spanId === spanId &&
      span.requestId === request.requestId,
  );
  if (!server) return false;
  if (request.clientTraceparent) {
    const [, clientTrace, clientSpan] = request.clientTraceparent.split("-");
    if (server.traceId !== clientTrace || server.parentSpanId !== clientSpan) return false;
    if (
      !spans.some(
        (span) =>
          span.service === `${service}-browser` &&
          span.name === "http.client.request" &&
          span.traceId === clientTrace &&
          span.spanId === clientSpan &&
          span.requestId === request.requestId,
      )
    )
      return false;
  } else if (request.method !== "GET" && request.method !== "HEAD") return false;
  const children = spans.filter(
    (span) =>
      span.service === `${service}-server` &&
      span.traceId === traceId &&
      span.parentSpanId === server.spanId &&
      span.requestId === request.requestId,
  );
  const successful = request.status >= 200 && request.status < 400;
  if (
    successful &&
    /^\/api\/(?:auth\/|profile$|users$|session$)/.test(request.path) &&
    !children.some((span) => span.name.startsWith("db."))
  )
    return false;
  if (
    successful &&
    request.path === "/api/auth/sign-up/email" &&
    !children.some((span) => span.name === "external.email")
  )
    return false;
  return true;
}
