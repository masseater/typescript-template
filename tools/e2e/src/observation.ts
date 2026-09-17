import { ensure, object, string } from "./support.ts";
import { httpStatus } from "./http.ts";

type Service = "user" | "admin" | "wiki";

interface ObservedRequest {
  readonly requestId: string;
  readonly traceparent: string;
  readonly clientTraceparent?: string;
  readonly path: string;
  readonly method: string;
  readonly status: number;
  readonly kind: string;
}

interface ObservedSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly service: string;
  readonly requestId?: string;
}

const traceIdBytes = 16;
const spanIdBytes = 8;
const hexCharactersPerByte = 2;
const secretKey =
  /^(?:password|newPassword|currentPassword|email|profile|token|secret|code|backupCode|backupCodes|totpURI)$/iu;
const databaseBackedPath = /^\/api\/(?:auth\/|profile$|users$|session$)/u;

function header(headers: Readonly<Record<string, unknown>>, name: string): string | undefined {
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  return typeof value === "string" ? value : undefined;
}

function secretsInValue(value: unknown): string[] {
  const values: unknown[] = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    if (typeof item !== "string" || item.length === 0) {
      return [];
    }
    const totpSecret = item.startsWith("otpauth:")
      ? new URL(item).searchParams.get("secret")
      : undefined;
    return typeof totpSecret === "string" && totpSecret.length > 0 ? [item, totpSecret] : [item];
  });
}

function findSecrets(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => findSecrets(entry));
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, entry]) =>
    secretKey.test(key) ? secretsInValue(entry) : findSecrets(entry),
  );
}

function assertPrivate(data: unknown, secrets: readonly string[]): void {
  const text = JSON.stringify(data);
  for (const secret of secrets.filter((candidate) => candidate.length > 0)) {
    const variants = [secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)];
    ensure(!variants.some((variant) => text.includes(variant)), "E2E_TELEMETRY_PII_LEAK");
  }
}

function id(value: unknown, bytes: number): string {
  const raw = string(value);
  if (new RegExp(`^[0-9a-f]{${bytes * hexCharactersPerByte}}$`, "u").test(raw)) {
    return raw;
  }
  const decoded = Buffer.from(raw, "base64");
  ensure(decoded.length === bytes, "E2E_TRACE_ID_ENCODING_INVALID");
  return decoded.toString("hex");
}

function attribute(input: unknown, name: string): string | undefined {
  if (!Array.isArray(input)) {
    return undefined;
  }
  const found: unknown = input.find((entry: unknown) => object(entry)["key"] === name);
  if (found === undefined) {
    return undefined;
  }
  const value = object(object(found)["value"])["stringValue"];
  return typeof value === "string" ? value : undefined;
}

function span(value: unknown, service: string): ObservedSpan {
  const raw = object(value);
  const parent = raw["parentSpanId"];
  const requestId = attribute(raw["attributes"], "request.id");
  return {
    name: string(raw["name"]),
    service,
    spanId: id(raw["spanId"], spanIdBytes),
    traceId: id(raw["traceId"], traceIdBytes),
    ...(typeof parent === "string" && parent.length > 0
      ? { parentSpanId: id(parent, spanIdBytes) }
      : {}),
    ...(requestId === undefined || requestId.length === 0 ? {} : { requestId }),
  };
}

function resourceSpans(raw: unknown): ObservedSpan[] {
  const resource = object(raw);
  const service = attribute(object(resource["resource"])["attributes"], "service.name");
  ensure(service !== undefined && service.length > 0, "E2E_TRACE_SERVICE_MISSING");
  const scopes = resource["scopeSpans"] ?? resource["instrumentationLibrarySpans"];
  ensure(Array.isArray(scopes), "E2E_TRACE_SCOPES_MISSING");
  return scopes.flatMap((scope: unknown) => {
    const { spans } = object(scope);
    ensure(Array.isArray(spans), "E2E_TRACE_SPANS_MISSING");
    return spans.map((value: unknown) => span(value, service));
  });
}

function traceSpans(input: unknown): ObservedSpan[] {
  const trace = object(input);
  const resources = trace["batches"] ?? trace["resourceSpans"];
  ensure(Array.isArray(resources), "E2E_TRACE_RESOURCES_MISSING");
  return resources.flatMap((raw: unknown) => resourceSpans(raw));
}

interface SpanContext {
  readonly request: ObservedRequest;
  readonly service: Service;
  readonly spans: readonly ObservedSpan[];
}

function clientSpanRelated(context: SpanContext, server: ObservedSpan): boolean {
  const { request, service, spans } = context;
  if (request.clientTraceparent === undefined || request.clientTraceparent.length === 0) {
    return request.method === "GET" || request.method === "HEAD";
  }
  const [, clientTrace, clientSpan] = request.clientTraceparent.split("-");
  return (
    server.traceId === clientTrace &&
    server.parentSpanId === clientSpan &&
    spans.some(
      (candidate) =>
        candidate.service === `${service}-browser` &&
        candidate.name === "http.client.request" &&
        candidate.traceId === clientTrace &&
        candidate.spanId === clientSpan &&
        candidate.requestId === request.requestId,
    )
  );
}

function childSpansRelated(context: SpanContext, server: ObservedSpan): boolean {
  const { request, service, spans } = context;
  const children = spans.filter(
    (candidate) =>
      candidate.service === `${service}-server` &&
      candidate.traceId === server.traceId &&
      candidate.parentSpanId === server.spanId &&
      candidate.requestId === request.requestId,
  );
  const successful = request.status >= httpStatus.ok && request.status < httpStatus.badRequest;
  if (!successful) {
    return true;
  }
  const databaseObserved =
    !databaseBackedPath.test(request.path) ||
    children.some((candidate) => candidate.name.startsWith("db."));
  const emailObserved =
    request.path !== "/api/auth/sign-up/email" ||
    children.some((candidate) => candidate.name === "external.email");
  return databaseObserved && emailObserved;
}

function relatedSpans(
  spans: readonly ObservedSpan[],
  request: ObservedRequest,
  service: Service,
): boolean {
  const [, traceId, spanId] = request.traceparent.split("-");
  const server = spans.find(
    (candidate) =>
      candidate.service === `${service}-server` &&
      candidate.traceId === traceId &&
      candidate.spanId === spanId &&
      candidate.requestId === request.requestId,
  );
  if (server === undefined) {
    return false;
  }
  const context = { request, service, spans };
  return clientSpanRelated(context, server) && childSpansRelated(context, server);
}

export { assertPrivate, findSecrets, header, relatedSpans, traceSpans };
export type { ObservedRequest, Service };
