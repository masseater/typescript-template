import { Effect, Schema } from "effect";

interface ExportedSpan {
  readonly name: string;
  readonly service: string;
  readonly spanId: string;
  readonly traceId: string;
}
interface ExportedLog {
  readonly message: string;
  readonly requestId: string | undefined;
  readonly service: string | undefined;
  readonly spanId: string | undefined;
  readonly traceId: string | undefined;
}
interface ExportedTelemetry {
  readonly logs: readonly ExportedLog[];
  readonly spans: readonly ExportedSpan[];
}

class ReceiverFailure extends Schema.TaggedError<ReceiverFailure>()("ReceiverFailure", {
  reason: Schema.Literals(["query_failed", "response_invalid"]),
}) {}

const tracesOrigin = "http://127.0.0.1:3200";
const logsOrigin = "http://127.0.0.1:3100";
const receiverTimeoutMilliseconds = 15_000;
const hexRadix = 16;
const hexByteWidth = 2;
const logWindowMilliseconds = 3_600_000;
const nanosecondsPerMillisecond = 1_000_000;

const Attribute = Schema.Struct({
  key: Schema.String,
  value: Schema.Struct({ stringValue: Schema.optionalKey(Schema.String) }),
});
const TempoSpan = Schema.Struct({
  name: Schema.String,
  spanId: Schema.String,
  traceId: Schema.String,
});
const TempoScope = Schema.Struct({ spans: Schema.Array(TempoSpan) });
const TempoResource = Schema.Struct({ attributes: Schema.Array(Attribute) });
const TempoBatch = Schema.Struct({
  resource: TempoResource,
  scopeSpans: Schema.Array(TempoScope),
});
const TempoTrace = Schema.Struct({ batches: Schema.Array(TempoBatch) });
const LokiValues = Schema.Array(Schema.Array(Schema.String));
const LokiStream = Schema.Struct({
  stream: Schema.Record(Schema.String, Schema.String),
  values: LokiValues,
});
const LokiStreams = Schema.Struct({ data: Schema.Struct({ result: Schema.Array(LokiStream) }) });

function hexIdentifier(base64: string): string {
  return Array.from(atob(base64), (character) =>
    (character.codePointAt(0) ?? 0).toString(hexRadix).padStart(hexByteWidth, "0"),
  ).join("");
}

function serviceName(attributes: readonly (typeof Attribute.Type)[]): string {
  return attributes.find((attribute) => attribute.key === "service.name")?.value.stringValue ?? "";
}

const receiverJson = Effect.fn("receiverJson")(function* receiverJson(url: string) {
  const response = yield* Effect.tryPromise({
    catch: () => new ReceiverFailure({ reason: "query_failed" }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    try: async (signal) =>
      fetch(url, {
        headers: { accept: "application/json" },
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(receiverTimeoutMilliseconds)]),
      }),
  });
  if (!response.ok) {
    return yield* Effect.fail(new ReceiverFailure({ reason: "query_failed" }));
  }
  return yield* Effect.tryPromise({
    catch: () => new ReceiverFailure({ reason: "response_invalid" }),
    try: async (): Promise<unknown> => response.json(),
  });
});

const exportedSpans = Effect.fn("exportedSpans")(function* exportedSpans(traceId: string) {
  const body = yield* receiverJson(new URL(`/api/traces/${traceId}`, tracesOrigin).href);
  const trace = yield* Schema.decodeUnknownEffect(TempoTrace)(body).pipe(
    Effect.mapError(() => new ReceiverFailure({ reason: "response_invalid" })),
  );
  return trace.batches.flatMap((batch) =>
    batch.scopeSpans.flatMap((scope) =>
      scope.spans.map((span): ExportedSpan => ({
        name: span.name,
        service: serviceName(batch.resource.attributes),
        spanId: hexIdentifier(span.spanId),
        traceId: hexIdentifier(span.traceId),
      })),
    ),
  );
});

const exportedLogs = Effect.fn("exportedLogs")(function* exportedLogs(traceId: string) {
  const url = new URL("/loki/api/v1/query_range", logsOrigin);
  url.searchParams.set("query", `{service_name=~".+"} | trace_id = "${traceId}"`);
  url.searchParams.set(
    "start",
    String((Date.now() - logWindowMilliseconds) * nanosecondsPerMillisecond),
  );
  const body = yield* receiverJson(url.href);
  const streams = yield* Schema.decodeUnknownEffect(LokiStreams)(body).pipe(
    Effect.mapError(() => new ReceiverFailure({ reason: "response_invalid" })),
  );
  return streams.data.result.flatMap((entry) =>
    entry.values.map((value): ExportedLog => ({
      message: value[1] ?? "",
      requestId: entry.stream["request_id"],
      service: entry.stream["service_name"],
      spanId: entry.stream["span_id"],
      traceId: entry.stream["trace_id"],
    })),
  );
});

const exportedTelemetry = Effect.fn("exportedTelemetry")(function* exportedTelemetry(
  traceId: string,
) {
  const [logs, spans] = yield* Effect.all([exportedLogs(traceId), exportedSpans(traceId)], {
    concurrency: "unbounded",
  });
  const telemetry: ExportedTelemetry = { logs, spans };
  return telemetry;
});

export { exportedTelemetry };
