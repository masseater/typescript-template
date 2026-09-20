// oxlint-disable-next-line import/no-nodejs-modules
import { once } from "node:events";
// oxlint-disable-next-line import/no-nodejs-modules
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
// oxlint-disable-next-line import/no-nodejs-modules
import { text } from "node:stream/consumers";

import { APPLICATION, loopbackAddress, loopbackOrigin } from "@repo/config";
import { flushTelemetry, httpStatus, observeRequest, Telemetry, TraceId } from "@repo/observability";
import { Cause, Effect, Schema } from "effect";

const spanName = "http.server.request";
const isTraceId = Schema.is(TraceId);

class ReceiverCheckFailure extends Schema.TaggedError<ReceiverCheckFailure>()(
  "ReceiverCheckFailure",
  { reason: Schema.String },
) {}

interface Inbox {
  failure: string | undefined;
  logs: unknown[];
  traces: unknown[];
}

interface Receiver {
  readonly inbox: Inbox;
  readonly origin: string;
  readonly server: Server;
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

const rejected = (inbox: Inbox, response: ServerResponse, reason: string): void => {
  inbox.failure = reason;
  if (!response.headersSent) {
    response.writeHead(httpStatus.internalServerError).end();
  }
};

const capture = Effect.fn("capture")(function* capture(
  inbox: Inbox,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const signal = signalOf(request.url);
  const contentType = request.headers["content-type"]?.split(";")[0];
  if (request.method !== "POST" || signal === undefined || contentType !== "application/json") {
    response.writeHead(httpStatus.notFound).end();
    return;
  }
  const raw = yield* Effect.tryPromise({
    catch: (error) => new ReceiverCheckFailure({ reason: describe(error) }),
    try: async () => text(request),
  });
  const parsed: unknown = yield* Effect.try({
    catch: () => new ReceiverCheckFailure({ reason: "response_invalid" }),
    try: (): unknown => JSON.parse(raw),
  });
  inbox[signal].push(parsed);
  response.writeHead(httpStatus.ok, { "content-type": "application/json" }).end("{}");
});

const accept = (inbox: Inbox, request: IncomingMessage, response: ServerResponse): void => {
  void Effect.runPromise(
    capture(inbox, request, response).pipe(
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          const squashed = Cause.squash(cause);
          rejected(
            inbox,
            response,
            squashed instanceof ReceiverCheckFailure ? squashed.reason : Cause.pretty(cause),
          );
        }),
      ),
    ),
  );
};

const openReceiver = Effect.tryPromise({
  catch: (error) => new ReceiverCheckFailure({ reason: describe(error) }),
  try: async (): Promise<Receiver> => {
    const inbox: Inbox = { failure: undefined, logs: [], traces: [] };
    const server = createServer((request, response) => {
      accept(inbox, request, response);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, loopbackAddress, () => {
        resolve();
      });
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      server.close();
      throw new Error("receiver did not bind");
    }
    return { inbox, origin: loopbackOrigin(address.port), server };
  },
});

const closeReceiver = (server: Server): Effect.Effect<void> =>
  Effect.tryPromise({
    catch: (error) => new ReceiverCheckFailure({ reason: describe(error) }),
    try: async () => {
      if (!server.listening) {
        return;
      }
      const closed = once(server, "close");
      server.closeAllConnections();
      server.close();
      await closed;
    },
  }).pipe(Effect.ignore);

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
    return yield* Effect.fail(new ReceiverCheckFailure({ reason }));
  }
  const arrival: ExportedArrival = { log: log.body, span: span.body, traceId: span.traceId };
  return arrival;
});

const exportedArrived = Effect.fn("exportedArrived")(function* exportedArrived() {
  return yield* Effect.acquireUseRelease(
    openReceiver,
    (receiver) =>
      deliver(receiver.origin).pipe(Effect.flatMap((lines) => matched(receiver.inbox, lines))),
    (receiver) => closeReceiver(receiver.server),
  );
});

const receiverFailureReason = (cause: Cause.Cause<ReceiverCheckFailure>): string => {
  const squashed = Cause.squash(cause);
  if (squashed instanceof ReceiverCheckFailure) {
    return squashed.reason;
  }
  return squashed instanceof Error ? squashed.message : "the receiver check failed";
};

export { exportedArrived, receiverFailureReason };
