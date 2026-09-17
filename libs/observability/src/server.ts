import { Cause, Context, Effect, Layer, Logger, References, Result, Schema } from "effect";
import { errorAttributes, errorFingerprint } from "./errors.ts";
import { browserEvents } from "./events.ts";
import { httpMethod, parentContext, randomHex, routeLabel, validateRoutes } from "./protocol.ts";
import type { Correlation, ServiceName } from "./protocol.ts";

export type { ServiceName } from "./protocol.ts";

export type RequestContext = Correlation & { readonly traceparent: string };

export class TelemetryInvalid extends Schema.TaggedError<TelemetryInvalid>()("TelemetryInvalid", {
  reason: Schema.Literals(["release", "service", "routes"]),
}) {}

export class Telemetry extends Context.Service<
  Telemetry,
  {
    readonly serviceName: ServiceName;
    readonly release: string;
    readonly routes: Readonly<Record<string, string>>;
    readonly labels: ReadonlySet<string>;
  }
>()("@template/observability/Telemetry") {
  static layer(options: {
    readonly serviceName: ServiceName;
    readonly release: string;
    readonly routes: Readonly<Record<string, string>>;
  }) {
    return Layer.effect(
      Telemetry,
      Effect.gen(function* () {
        if (!/^[a-zA-Z0-9._-]{1,64}$/.test(options.release))
          return yield* new TelemetryInvalid({ reason: "release" });
        if (!["user", "admin", "wiki"].includes(options.serviceName))
          return yield* new TelemetryInvalid({ reason: "service" });
        yield* Effect.try({
          try: () => validateRoutes(options.routes),
          catch: () => new TelemetryInvalid({ reason: "routes" }),
        });
        return Telemetry.of({
          ...options,
          labels: new Set([...Object.values(options.routes), "unmatched"]),
        });
      }),
    ).pipe(Layer.provideMerge(structuredLogs(options)));
  }
}

export class CurrentRequest extends Context.Service<CurrentRequest, RequestContext>()(
  "@template/observability/CurrentRequest",
) {}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const structuredLogs = (options: { readonly serviceName: ServiceName; readonly release: string }) =>
  Logger.layer([
    Logger.make(({ message, logLevel, fiber }) => {
      const parts: ReadonlyArray<unknown> = Array.isArray(message) ? message : [message];
      const [event, attributes] = parts;
      const line = JSON.stringify({
        event: typeof event === "string" ? event : "application.log",
        service: `${options.serviceName}-server`,
        release: options.release,
        ...fiber.getRef(References.CurrentLogAnnotations),
        ...(record(attributes) ? attributes : {}),
      });
      if (logLevel === "Error" || logLevel === "Fatal" || logLevel === "Warn") console.error(line);
      else console.info(line);
    }),
  ]);

const failureAttributes = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);
  const tag =
    record(error) && typeof error["_tag"] === "string" && /^[A-Za-z]{1,64}$/.test(error["_tag"])
      ? error["_tag"]
      : undefined;
  const attributes = errorAttributes(error);
  return tag === undefined
    ? attributes
    : {
        ...attributes,
        "error.tag": tag,
        "error.fingerprint": errorFingerprint(
          attributes["error.type"],
          `${tag}\n${attributes["error.locations"]}`,
        ),
      };
};

export const reportFailure = (cause: Cause.Cause<unknown>) =>
  Effect.logError("application.error", failureAttributes(cause));

const responseHeaders = (response: Response, context: RequestContext) => {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", context.requestId);
  headers.set("traceparent", context.traceparent);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const observeRequest = <R>(
  request: Request,
  handler: (request: Request) => Effect.Effect<Response, never, R | CurrentRequest>,
) =>
  Effect.suspend(() => {
    const traceId = parentContext(request.headers.get("traceparent"))?.traceId ?? randomHex(16);
    const spanId = randomHex(8);
    const context: RequestContext = {
      traceId,
      spanId,
      requestId: crypto.randomUUID(),
      traceparent: `00-${traceId}-${spanId}-01`,
    };
    return respond(request, context, handler).pipe(
      Effect.annotateLogs({
        request_id: context.requestId,
        trace_id: context.traceId,
        span_id: context.spanId,
      }),
    );
  });

const respond = <R>(
  request: Request,
  context: RequestContext,
  handler: (request: Request) => Effect.Effect<Response, never, R | CurrentRequest>,
) =>
  Effect.gen(function* () {
    const telemetry = yield* Telemetry;
    const start = performance.now();
    const response = yield* handler(request).pipe(
      Effect.provideService(CurrentRequest, context),
      Effect.catchCause((cause) =>
        reportFailure(cause).pipe(
          Effect.as(
            Response.json(
              { error: "処理に失敗しました。リクエスト ID でログを確認してください。" },
              { status: 500, headers: { "cache-control": "no-store" } },
            ),
          ),
        ),
      ),
    );
    const attributes = {
      method: httpMethod(request.method),
      route: routeLabel(new URL(request.url).pathname, telemetry.routes),
      status: response.status,
      duration_ms: performance.now() - start,
    };
    yield* response.status >= 500
      ? Effect.logError("http.server.request", attributes)
      : Effect.logInfo("http.server.request", attributes);
    return responseHeaders(response, context);
  });

const telemetryResponse = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers: { "cache-control": "no-store", ...headers } });

export const ingestBrowser = (request: Request) =>
  Effect.gen(function* () {
    const telemetry = yield* Telemetry;
    if (request.method !== "POST") return telemetryResponse(405, { allow: "POST" });
    if (
      request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return telemetryResponse(403);
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
      return telemetryResponse(415);
    const body = yield* readBoundedText(request, 32768);
    if (body.kind === "too_large") return telemetryResponse(413);
    const input = Result.try((): unknown => JSON.parse(body.kind === "text" ? body.text : ""));
    if (Result.isFailure(input)) return telemetryResponse(400);
    const events = yield* Schema.decodeUnknownEffect(browserEvents(telemetry.labels, Date.now()), {
      onExcessProperty: "error",
    })(input.success).pipe(Effect.option);
    if (events._tag === "None") return telemetryResponse(400);
    if (!admitBrowserEvents(telemetry.serviceName, events.value.length))
      return telemetryResponse(429, { "retry-after": "60" });
    for (const event of events.value) {
      const failed =
        event.kind === "exception" ||
        (event.kind === "http" && (event.status === 0 || event.status >= 400));
      const attributes = {
        service: `${telemetry.serviceName}-browser`,
        request_id: event.requestId,
        trace_id: event.traceId,
        span_id: event.spanId,
        "telemetry.source": "untrusted-browser",
        "http.route": event.route,
        ...(event.kind === "http"
          ? { "http.request.method": event.method, "http.response.status_code": event.status }
          : {}),
        ...(event.kind === "exception"
          ? {
              "error.type": event.errorType,
              "error.locations": event.locations,
              "error.fingerprint": errorFingerprint(event.errorType, event.locations),
            }
          : {}),
        duration_ms: event.duration,
        measurement_value: event.value,
        start: new Date(event.start).toISOString(),
      };
      yield* failed
        ? Effect.logError(event.name, attributes)
        : Effect.logInfo(event.name, attributes);
    }
    return telemetryResponse(202);
  });

const ingressWindows = new Map<ServiceName, { start: number; count: number }>();

const admitBrowserEvents = (service: ServiceName, count: number) => {
  const now = Date.now();
  const window = ingressWindows.get(service) ?? { start: now, count: 0 };
  if (now - window.start > 60_000) {
    window.start = now;
    window.count = 0;
  }
  ingressWindows.set(service, window);
  if (window.count + count > 1200) return false;
  window.count += count;
  return true;
};

type BoundedText =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "too_large" }
  | { readonly kind: "missing" };

export const readBoundedText = (request: Request, limit: number) =>
  Effect.promise(async (): Promise<BoundedText> => {
    if (Number(request.headers.get("content-length")) > limit) return { kind: "too_large" };
    const reader = request.body?.getReader();
    if (!reader) return { kind: "missing" };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return { kind: "too_large" };
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return { kind: "text", text: new TextDecoder().decode(bytes) };
  });
