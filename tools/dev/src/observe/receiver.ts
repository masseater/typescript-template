import { NodeHttpServer } from "@effect/platform-node";
import { APPLICATION, loopbackAddress, loopbackOrigin, httpStatus } from "@repo/config";

import { flushTelemetry, observeRequest, Telemetry, TraceId } from "@repo/observability";

import { Cause, Context, Effect, Exit, Layer, Ref, Schema, Scope } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

const spanName = "http.server.request";
const isTraceId = Schema.is(TraceId);

class ReceiverCheckFailure extends Schema.TaggedError<ReceiverCheckFailure>()(
  "ReceiverCheckFailure",
  { reason: Schema.String },
) {}

const isReceiverCheckFailure = Schema.is(ReceiverCheckFailure);

interface Inbox {
  failure: string | undefined;
  logs: unknown[];
  traces: unknown[];
}

interface OpenedReceiver {
  readonly inbox: Ref.Ref<Inbox>;
  readonly origin: string;
  readonly scope: Scope.Scope;
}

interface Signal {
  readonly body: string;
  readonly traceId: string;
}

interface ExportedArrival {
  readonly log: string;
  readonly span: string;
  readonly traceId: string;
}

const StringBody = Schema.Struct({
  stringValue: Schema.optionalKey(Schema.String),
});
const LogRecord = Schema.Struct({
  body: Schema.optionalKey(StringBody),
  traceId: Schema.optionalKey(Schema.String),
});
const LogData = Schema.Struct({
  resourceLogs: Schema.Array(
    Schema.Struct({
      scopeLogs: Schema.Array(
        Schema.Struct({
          logRecords: Schema.optionalKey(Schema.Array(LogRecord)),
        }),
      ),
    }),
  ),
});
const SpanData = Schema.Struct({
  name: Schema.String,
  traceId: Schema.String,
});
const TraceData = Schema.Struct({
  resourceSpans: Schema.Array(
    Schema.Struct({
      scopeSpans: Schema.Array(
        Schema.Struct({
          spans: Schema.Array(SpanData),
        }),
      ),
    }),
  ),
});

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function signalOf(url: string | undefined): "logs" | "traces" | undefined {
  const path = url?.split("?")[0];
  if (path === "/v1/logs") {
    return "logs";
  }
  if (path === "/v1/traces") {
    return "traces";
  }
  return undefined;
}

const capture = (
  inbox: Ref.Ref<Inbox>,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  ReceiverCheckFailure,
  HttpServerRequest.HttpServerRequest
> =>
  Effect.gen(function* captureProgram() {
    const incoming = yield* HttpServerRequest.HttpServerRequest;
    const signal = signalOf(incoming.url);
    const contentType = incoming.headers["content-type"]?.split(";")[0];
    if (incoming.method !== "POST" || signal === undefined || contentType !== "application/json") {
      return HttpServerResponse.empty({ status: httpStatus.notFound });
    }
    const raw = yield* incoming.text.pipe(
      Effect.mapError((error) => new ReceiverCheckFailure({ reason: describe(error) })),
    );
    const parsed = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(raw).pipe(
      Effect.mapError(() => new ReceiverCheckFailure({ reason: "response_invalid" })),
    );
    yield* Ref.update(inbox, (current) => ({
      ...current,
      [signal]: [...current[signal], parsed],
    }));
    return HttpServerResponse.text("{}", {
      contentType: "application/json",
      status: httpStatus.ok,
    });
  });

const openReceiver = Effect.gen(function* openReceiverProgram() {
  const scope = yield* Scope.make();
  const built = yield* Layer.build(NodeHttpServer.layerTest).pipe(
    Scope.provide(scope),
    Effect.mapError((error) => new ReceiverCheckFailure({ reason: describe(error) })),
  );
  const server = Context.get(built, HttpServer.HttpServer);
  const inbox = yield* Ref.make<Inbox>({ failure: undefined, logs: [], traces: [] });
  yield* server
    .serve(
      capture(inbox).pipe(
        Effect.catchCause((cause) =>
          Effect.gen(function* reject() {
            yield* Ref.update(inbox, (current) => ({
              ...current,
              failure: receiverFailureReason(cause),
            }));
            return HttpServerResponse.empty({ status: httpStatus.internalServerError });
          }),
        ),
      ),
    )
    .pipe(Scope.provide(scope));
  if (server.address._tag !== "TcpAddress") {
    yield* Scope.close(scope, Exit.succeed(undefined));
    return yield* new ReceiverCheckFailure({ reason: "receiver did not bind" });
  }
  const opened: OpenedReceiver = {
    inbox,
    origin: loopbackOrigin(server.address.port),
    scope,
  };
  return opened;
});

const closeReceiver = (scope: Scope.Scope): Effect.Effect<void> =>
  Scope.close(scope, Exit.succeed(undefined)).pipe(Effect.ignore);

const deliver = Effect.fn("deliver")(function* deliver(origin: string) {
  const lines: string[] = [];
  const record = (line: string): void => {
    lines.push(line);
  };
  yield* Effect.gen(function* program() {
    yield* observeRequest(new Request(`http://${loopbackAddress}/`), () =>
      Effect.succeed(new Response(null, { status: httpStatus.noContent })),
    );
    yield* flushTelemetry;
  }).pipe(
    Effect.provide(
      Telemetry.layer({
        log: { error: record, info: record, warn: record },
        otlp: { endpoint: origin },
        release: "receiver-check",
        routes: { "/": "home" },
        serviceName: APPLICATION.user,
      }),
    ),
    Effect.mapError((invalid) => new ReceiverCheckFailure({ reason: invalid.reason })),
  );
  return lines;
});

function decode<Decoded extends Schema.Top & { readonly DecodingServices: never }>(
  schema: Decoded,
  body: unknown,
): Effect.Effect<Decoded["Type"], ReceiverCheckFailure> {
  return Schema.decodeUnknownEffect(schema)(body).pipe(
    Effect.mapError(() => new ReceiverCheckFailure({ reason: "response_invalid" })),
  );
}

const logSignals = Effect.fn("logSignals")(function* logSignals(bodies: readonly unknown[]) {
  const payloads = yield* Effect.forEach(bodies, (body) => decode(LogData, body));
  return payloads.flatMap((payload) =>
    payload.resourceLogs.flatMap((resource) =>
      resource.scopeLogs.flatMap((scope) =>
        (scope.logRecords ?? []).flatMap((record): readonly Signal[] => {
          const body = record.body?.stringValue;
          const { traceId } = record;
          return body === undefined || traceId === undefined ? [] : [{ body, traceId }];
        }),
      ),
    ),
  );
});

const spanSignals = Effect.fn("spanSignals")(function* spanSignals(bodies: readonly unknown[]) {
  const payloads = yield* Effect.forEach(bodies, (body) => decode(TraceData, body));
  return payloads.flatMap((payload) =>
    payload.resourceSpans.flatMap((resource) =>
      resource.scopeSpans.flatMap((scope) =>
        scope.spans.map((span): Signal => ({ body: span.name, traceId: span.traceId })),
      ),
    ),
  );
});

const matched = Effect.fn("matched")(function* matched(inbox: Inbox, lines: readonly string[]) {
  const logs = yield* logSignals(inbox.logs);
  const spans = yield* spanSignals(inbox.traces);
  const span = spans.find((found) => found.body === spanName && isTraceId(found.traceId));
  const log = logs.find((found) => found.body === spanName && found.traceId === span?.traceId);
  if (span === undefined || log === undefined) {
    const exportFailure = lines.find((line) => line.includes('"event":"otlp.export_failed"'));
    const reason =
      inbox.failure ??
      exportFailure ??
      `receiver returned no match (logs=${inbox.logs.length}, traces=${inbox.traces.length})`;
    return yield* new ReceiverCheckFailure({ reason });
  }
  const arrival: ExportedArrival = { log: log.body, span: span.body, traceId: span.traceId };
  return arrival;
});

const exportedArrived = Effect.fn("exportedArrived")(function* exportedArrived() {
  return yield* Effect.acquireUseRelease(
    openReceiver,
    (receiver) =>
      deliver(receiver.origin).pipe(
        Effect.flatMap((lines) =>
          Ref.get(receiver.inbox).pipe(Effect.flatMap((inbox) => matched(inbox, lines))),
        ),
      ),
    (receiver) => closeReceiver(receiver.scope),
  );
});

const receiverFailureReason = (cause: Cause.Cause<ReceiverCheckFailure>): string => {
  const squashed = Cause.squash(cause);
  if (isReceiverCheckFailure(squashed)) {
    return squashed.reason;
  }
  return squashed instanceof Error ? squashed.message : "the receiver check failed";
};

export { exportedArrived, receiverFailureReason };
