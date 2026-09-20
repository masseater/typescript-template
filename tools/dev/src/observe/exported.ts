import { Effect, Schema } from "effect";

interface ExportedSpan {
  readonly name: string;
  readonly service: string | undefined;
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
interface ReceiverOrigins {
  readonly logs: string;
  readonly traces: string;
}
interface ExportedTelemetry {
  readonly logs: readonly ExportedLog[];
  readonly spans: readonly ExportedSpan[];
}

class ReceiverFailure extends Schema.TaggedError<ReceiverFailure>()("ReceiverFailure", {
  reason: Schema.Literals(["query_failed", "response_invalid"]),
}) {}

const receiverTimeoutMilliseconds = 15_000;
const millisecondsPerMinute = 60_000;
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
const LokiEntry = Schema.Tuple([Schema.String, Schema.String]);
const LokiStream = Schema.Struct({
  stream: Schema.Record(Schema.String, Schema.String),
  values: Schema.Array(LokiEntry),
});
const LokiStreams = Schema.Struct({ data: Schema.Struct({ result: Schema.Array(LokiStream) }) });

function hexIdentifier(base64: string): string {
  return Buffer.from(base64, "base64").toString("hex");
}

function serviceName(attributes: readonly (typeof Attribute.Type)[]): string | undefined {
  return attributes.find((attribute) => attribute.key === "service.name")?.value.stringValue;
}

const receiverJson = Effect.fn("receiverJson")(function* receiverJson(url: string) {
  const response = yield* Effect.tryPromise({
    catch: () => new ReceiverFailure({ reason: "query_failed" }),
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

function decoded<Decoded extends Schema.Top & { readonly DecodingServices: never }>(
  schema: Decoded,
  body: unknown,
): Effect.Effect<Decoded["Type"], ReceiverFailure> {
  return Schema.decodeUnknownEffect(schema)(body).pipe(
    Effect.mapError(() => new ReceiverFailure({ reason: "response_invalid" })),
  );
}

const exportedSpans = Effect.fn("exportedSpans")(function* exportedSpans(
  receiver: ReceiverOrigins,
  traceId: string,
) {
  const body = yield* receiverJson(new URL(`/api/traces/${traceId}`, receiver.traces).href);
  const trace = yield* decoded(TempoTrace, body);
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

const exportedLogs = Effect.fn("exportedLogs")(function* exportedLogs(
  receiver: ReceiverOrigins,
  traceId: string,
  minutes: number,
) {
  const now = Date.now();
  const url = new URL("/loki/api/v1/query_range", receiver.logs);
  url.searchParams.set("query", `{service_name=~".+"} | trace_id = "${traceId}"`);
  url.searchParams.set(
    "start",
    String((now - minutes * millisecondsPerMinute) * nanosecondsPerMillisecond),
  );
  url.searchParams.set("end", String(now * nanosecondsPerMillisecond));
  const body = yield* receiverJson(url.href);
  const streams = yield* decoded(LokiStreams, body);
  return streams.data.result.flatMap((entry) =>
    entry.values.map(([, message]): ExportedLog => ({
      message,
      requestId: entry.stream["request_id"],
      service: entry.stream["service_name"],
      spanId: entry.stream["span_id"],
      traceId: entry.stream["trace_id"],
    })),
  );
});

const exportedTelemetry = Effect.fn("exportedTelemetry")(function* exportedTelemetry(
  receiver: ReceiverOrigins,
  traceId: string,
  minutes: number,
) {
  const [logs, spans] = yield* Effect.all(
    [exportedLogs(receiver, traceId, minutes), exportedSpans(receiver, traceId)],
    { concurrency: "unbounded" },
  );
  const telemetry: ExportedTelemetry = { logs, spans };
  return telemetry;
});

export { exportedTelemetry };
export type { ReceiverOrigins };
