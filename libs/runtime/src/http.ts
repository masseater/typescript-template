import { httpStatus, readJson, type Reporting, type RequestRejected } from "@repo/observability";
import { Effect, Exit, Schema, Stream, type Cause } from "effect";
import { Elysia, sse, status, type AnyElysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

import { AppOrigin } from "./app-origin.ts";
import {
  failureResponse,
  reportedFailure,
  runtimeUnavailable,
  type CommonFailure,
  type Failure,
  type FailureStatus,
  type FailureTable,
  type Tagged,
} from "./failures.ts";
import { InputInvalid } from "./input-invalid.ts";
import { jsonResponse } from "./responses.ts";

import type { WorkerRuntime } from "./worker-runtime.ts";
type Handler<Value, Failures, Requirements> = (
  httpRequest: Request,
) => Effect.Effect<Value, Failures, Requirements>;
type ElysiaContext = {
  readonly request: Request;
};
type ElysiaStreamContext = ElysiaContext & {
  readonly set: {
    headers: Record<string, string | number>;
  };
};
type ServerSentEvent = {
  readonly data: unknown;
  readonly event: string;
};
type FailedEvent = {
  readonly data: Readonly<{
    message: string;
    status: FailureStatus;
  }>;
  readonly event: "failed";
};
type ElysiaHandler = (runtimeContext: ElysiaContext) => Promise<Response>;
type Failed = ReturnType<
  typeof status<
    FailureStatus,
    {
      readonly error: string;
    }
  >
>;
type EventStream<Encoded> = AsyncGenerator<Encoded, void>;
type ApiRoutes<Requirements> = {
  readonly events: <Value, Encoded extends ServerSentEvent, Failures extends Tagged>(
    logEvent: Schema.Codec<Value, Encoded>,
  ) => (
    routeHandler: Handler<Stream.Stream<Value, never, Requirements>, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => (
    runtimeContext: ElysiaStreamContext,
  ) => Promise<EventStream<Encoded | FailedEvent> | Failed>;
  readonly raw: <Failures extends Tagged>(
    routeHandler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => ElysiaHandler;
  readonly route: <Value, Encoded, Failures extends Tagged>(
    httpResponse: Schema.Codec<Value, Encoded>,
  ) => (
    routeHandler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => (runtimeContext: ElysiaContext) => Promise<Encoded | Failed>;
};
type Decodable = Schema.Top & {
  readonly DecodingServices: never;
};
const decodeInput = <Contract extends Decodable>(
  schema: Contract,
  input: unknown,
): Effect.Effect<Contract["Type"], InputInvalid> => {
  return Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(() => new InputInvalid()),
  );
};
const readJsonBody = <Contract extends Decodable>(
  schema: Contract,
  httpRequest: Request,
): Effect.Effect<Contract["Type"], RequestRejected | InputInvalid, AppOrigin> => {
  return Effect.gen(function* readJsonBodyProgram() {
    const input = yield* readJson({ expectedOrigin: yield* AppOrigin, incoming: httpRequest });
    return yield* decodeInput(schema, input);
  });
};
const readSearchParams = <Contract extends Decodable>(
  schema: Contract,
  httpRequest: Request,
): Effect.Effect<Contract["Type"], InputInvalid> => {
  return decodeInput(schema, Object.fromEntries(new URL(httpRequest.url).searchParams));
};
const apiRoot = "/api";
const missingMessage = "見つかりませんでした。";
const unreadBody = { unread: true } as const;
const createApi = <const Prefix extends string>(prefix: Prefix) => {
  return new Elysia({ adapter: CloudflareAdapter, aot: false, prefix })
    .onParse(() => unreadBody)
    .onError(({ code }) =>
      code === "NOT_FOUND" ? status(httpStatus.notFound, { error: missingMessage }) : undefined,
    );
};
const eventStreamType = "text/event-stream";
const elysiaServer = (
  app: AnyElysia,
): {
  readonly handlers: Readonly<{
    ANY: ElysiaHandler;
    HEAD: ElysiaHandler;
  }>;
} => {
  const handle = (runtimeContext: ElysiaContext): Promise<Response> => {
    return Promise.resolve(app.fetch(runtimeContext.request));
  };
  const handleHead = (runtimeContext: ElysiaContext): Promise<Response> =>
    Effect.runPromise(
      Effect.gen(function* headProgram() {
        const { headers: asked, url } = runtimeContext.request;
        const httpResponse = yield* Effect.promise(() =>
          Promise.resolve(app.fetch(new Request(url, { headers: asked, method: "GET" }))),
        );
        const streamsEvents =
          httpResponse.headers.get("content-type")?.startsWith(eventStreamType) === true;
        if (streamsEvents) {
          void httpResponse.body?.cancel();
        }
        let requestBody: ArrayBuffer | undefined;
        if (!streamsEvents) {
          requestBody = yield* Effect.promise(() => httpResponse.arrayBuffer());
        }
        const lengthHeader: [string, string][] =
          requestBody === undefined ? [] : [["content-length", String(requestBody.byteLength)]];
        const headers = new Headers([...httpResponse.headers, ...lengthHeader]);
        return new Response(undefined, {
          headers,
          status: httpResponse.status,
          statusText: httpResponse.statusText,
        });
      }),
    );
  return {
    handlers: {
      ANY: handle,
      HEAD: handleHead,
    },
  };
};
const unavailableResponse = (
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<Response> => {
  return runtimeUnavailable(cause, reporting).pipe(
    Effect.map((failure) => jsonResponse({ error: failure.message }, failure.status)),
  );
};
const failedStatus = (failure: Failure): Failed => {
  return status(failure.status, { error: failure.message });
};
const unavailableStatus = (
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<Failed> => {
  return runtimeUnavailable(cause, reporting).pipe(Effect.map(failedStatus));
};
const respondRaw = <Failures extends Tagged, Requirements>(
  routeHandler: Handler<Response, Failures, Requirements>,
  failures: FailureTable<Exclude<Failures, CommonFailure>>,
): ((httpRequest: Request) => Effect.Effect<Response, never, Requirements>) => {
  return (httpRequest) =>
    routeHandler(httpRequest).pipe(Effect.catchCause((cause) => failureResponse(failures, cause)));
};
const respondValue = <Value, Encoded, Failures extends Tagged, Requirements>(
  httpResponse: Schema.Codec<Value, Encoded>,
) => {
  const encode = Schema.encodeEffect(httpResponse);
  return (
    routeHandler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): ((httpRequest: Request) => Effect.Effect<Encoded | Failed, never, Requirements>) => {
    return (httpRequest) =>
      routeHandler(httpRequest).pipe(
        Effect.flatMap((decoded) => Effect.orDie(encode(decoded))),
        Effect.catchCause((cause) =>
          reportedFailure(failures, cause).pipe(Effect.map(failedStatus)),
        ),
      );
  };
};
class EventFeed<Encoded extends ServerSentEvent> implements EventStream<Encoded> {
  private readonly source: AsyncIterator<Encoded>;
  public constructor(logEvents: AsyncIterable<Encoded>) {
    this.source = logEvents[Symbol.asyncIterator]();
  }
  public next(): Promise<IteratorResult<Encoded, void>> {
    const { source } = this;
    return Effect.runPromise(
      Effect.gen(function* nextFrame() {
        const step = yield* Effect.promise(() => source.next());
        if (step.done === true) {
          return { done: true as const, value: undefined };
        }
        const frame = sse({ data: step.value.data, event: step.value.event });
        return { done: false as const, value: { ...step.value, ...frame } };
      }),
    );
  }
  public return(): Promise<IteratorResult<Encoded, void>> {
    const { source } = this;
    return Effect.runPromise(
      Effect.gen(function* returnFrame() {
        yield* Effect.promise(() => Promise.resolve(source.return?.()));
        return { done: true as const, value: undefined };
      }),
    );
  }
  public throw(): Promise<IteratorResult<Encoded, void>> {
    return this.return();
  }
  public [Symbol.asyncIterator](): this {
    return this;
  }
  public [Symbol.asyncDispose](): Promise<void> {
    const dispose = this.return.bind(this);
    return Effect.runPromise(
      Effect.gen(function* disposeFrame() {
        yield* Effect.promise(() => dispose());
      }),
    );
  }
}
const failedEventOf = (failure: Failure): FailedEvent => ({
  data: { message: failure.message, status: failure.status },
  event: "failed",
});
export { AppOrigin } from "./app-origin.ts";
export { Assets } from "./assets.ts";
export { InputInvalid } from "./input-invalid.ts";
export { jsonResponse, secureResponse } from "./responses.ts";
const apiRoutes = <Requirements>(
  runtime: WorkerRuntime<Requirements, unknown>,
  reporting: Reporting,
): ApiRoutes<Requirements> => {
  const openStream = <Value, Encoded extends ServerSentEvent, Failures extends Tagged>(
    logEvent: Schema.Codec<Value, Encoded>,
  ) => {
    const encode = Schema.encodeEffect(logEvent);
    return (
      routeHandler: Handler<Stream.Stream<Value, never, Requirements>, Failures, Requirements>,
      failures: FailureTable<Exclude<Failures, CommonFailure>>,
    ): ((
      httpRequest: Request,
    ) => Effect.Effect<EventStream<Encoded | FailedEvent> | Failed, never, Requirements>) => {
      const failureStream = (cause: Readonly<Cause.Cause<unknown>>): Stream.Stream<FailedEvent> =>
        Stream.fromEffect(reportedFailure(failures, cause).pipe(Effect.map(failedEventOf)));
      return (httpRequest) =>
        routeHandler(httpRequest).pipe(
          Effect.flatMap((decodedList) =>
            Stream.toAsyncIterableEffect(
              Stream.mapEffect(decodedList, (decoded) => Effect.orDie(encode(decoded))).pipe(
                Stream.catchCause(failureStream),
              ),
            ),
          ),
          Effect.map((logEvents) => new EventFeed(logEvents)),
          Effect.catchCause((cause) =>
            reportedFailure(failures, cause).pipe(Effect.map(failedStatus)),
          ),
        );
    };
  };
  const streamHeaders = { "cache-control": "no-store", "content-encoding": "identity" };
  const settle = <Value>(
    runtimeContext: ElysiaContext,
    settled: {
      readonly program: (httpRequest: Request) => Effect.Effect<Value, never, Requirements>;
      readonly unavailable: (cause: Readonly<Cause.Cause<unknown>>) => Effect.Effect<Value>;
    },
  ): Promise<Value> =>
    Effect.runPromise(
      Effect.gen(function* settleProgram() {
        const exit = yield* Effect.promise(() =>
          runtime.runPromiseExit(settled.program(runtimeContext.request)),
        );
        return Exit.isSuccess(exit) ? exit.value : yield* settled.unavailable(exit.cause);
      }),
    );
  const raw = <Failures extends Tagged>(
    routeHandler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): ElysiaHandler => {
    return (runtimeContext): Promise<Response> =>
      settle(runtimeContext, {
        program: respondRaw(routeHandler, failures),
        unavailable: (cause) => unavailableResponse(cause, reporting),
      });
  };
  const route = <Value, Encoded, Failures extends Tagged>(
    httpResponse: Schema.Codec<Value, Encoded>,
  ) => {
    return (
      routeHandler: Handler<Value, Failures, Requirements>,
      failures: FailureTable<Exclude<Failures, CommonFailure>>,
    ): ((runtimeContext: ElysiaContext) => Promise<Encoded | Failed>) => {
      return (runtimeContext): Promise<Encoded | Failed> =>
        settle(runtimeContext, {
          program: respondValue<Value, Encoded, Failures, Requirements>(httpResponse)(
            routeHandler,
            failures,
          ),
          unavailable: (cause) => unavailableStatus(cause, reporting),
        });
    };
  };
  const logEvents = <Value, Encoded extends ServerSentEvent, Failures extends Tagged>(
    logEvent: Schema.Codec<Value, Encoded>,
  ) => {
    return (
      routeHandler: Handler<Stream.Stream<Value, never, Requirements>, Failures, Requirements>,
      failures: FailureTable<Exclude<Failures, CommonFailure>>,
    ): ((
      runtimeContext: ElysiaStreamContext,
    ) => Promise<EventStream<Encoded | FailedEvent> | Failed>) => {
      const open = openStream<Value, Encoded, Failures>(logEvent)(routeHandler, failures);
      return (runtimeContext): Promise<EventStream<Encoded | FailedEvent> | Failed> =>
        Effect.runPromise(
          Effect.gen(function* openEvents() {
            const opened = yield* Effect.promise(() =>
              settle(runtimeContext, {
                program: open,
                unavailable: (cause) => unavailableStatus(cause, reporting),
              }),
            );
            if (opened instanceof EventFeed) {
              Object.assign(runtimeContext.set.headers, streamHeaders);
            }
            return opened;
          }),
        );
    };
  };
  return { events: logEvents, raw, route };
};
export { apiRoot, apiRoutes, createApi, elysiaServer, readJsonBody, readSearchParams };
export type { ApiRoutes };
export type { Failure, FailureTable } from "./failures.ts";
