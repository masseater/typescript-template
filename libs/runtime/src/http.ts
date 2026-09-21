import { httpStatus, readJson } from "@repo/observability";
import { Effect, Exit, Schema, Stream } from "effect";
import { Elysia, NotFound, sse, status } from "elysia";
import { WebStandardAdapter } from "elysia/adapter/web-standard";

import { AppOrigin } from "./app-origin.ts";
import { failureResponse, reportedFailure, runtimeUnavailable } from "./failures.ts";
import { InputInvalid } from "./input-invalid.ts";
import { jsonResponse } from "./responses.ts";

import type { Reporting, RequestRejected } from "@repo/observability";
import type { Cause } from "effect";
import type { AnyElysia, Context } from "elysia";
import type { CommonFailure, Failure, FailureStatus, FailureTable, Tagged } from "./failures.ts";
import type { WorkerRuntime } from "./worker-runtime.ts";

type Decodable = Schema.Top & { readonly DecodingServices: never };
type Handler<Value, Failures, Requirements> = (
  request: Request,
) => Effect.Effect<Value, Failures, Requirements>;
interface ServerSentEvent {
  readonly data: unknown;
  readonly event: string;
}
interface FailedEvent {
  readonly data: Readonly<{ message: string; status: FailureStatus }>;
  readonly event: "failed";
}
type ElysiaHandler = (context: { readonly request: Request }) => Promise<Response>;
type Failed = ReturnType<typeof status<FailureStatus, { readonly error: string }>>;
type EventStream<Encoded> = AsyncGenerator<Encoded, void>;
interface ApiRoutes<Requirements> {
  readonly events: <Value, Encoded extends ServerSentEvent, Failures extends Tagged>(
    event: Schema.Codec<Value, Encoded>,
    handler: Handler<Stream.Stream<Value, never, Requirements>, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ) => (context: Context) => Promise<EventStream<Encoded | FailedEvent> | Failed>;
  readonly raw: <Failures extends Tagged>(
    handler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => ElysiaHandler;
  readonly route: <Value, Encoded, Failures extends Tagged>(
    response: Schema.Codec<Value, Encoded>,
    handler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => (context: Context) => Promise<Encoded | Failed>;
}

const missingMessage = "見つかりませんでした。";
const eventStreamType = "text/event-stream";

function decodeInput<Contract extends Decodable>(
  schema: Contract,
  input: unknown,
): Effect.Effect<Contract["Type"], InputInvalid> {
  return Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(() => new InputInvalid()),
  );
}

function readJsonBody<Contract extends Decodable>(
  schema: Contract,
  request: Request,
): Effect.Effect<Contract["Type"], RequestRejected | InputInvalid, AppOrigin> {
  return Effect.gen(function* readJsonBodyProgram() {
    const input = yield* readJson({ expectedOrigin: yield* AppOrigin, incoming: request });
    return yield* decodeInput(schema, input);
  });
}

function readSearchParams<Contract extends Decodable>(
  schema: Contract,
  request: Request,
): Effect.Effect<Contract["Type"], InputInvalid> {
  return decodeInput(schema, Object.fromEntries(new URL(request.url).searchParams));
}

const apiRoot = "/api";

function createApi<const Prefix extends string>(prefix: Prefix) {
  return new Elysia({ adapter: WebStandardAdapter, prefix })
    .guard({ parse: "none" })
    .error(({ error }) =>
      error instanceof NotFound
        ? status(httpStatus.notFound, { error: missingMessage })
        : undefined,
    );
}

function elysiaServer(app: AnyElysia): {
  readonly handlers: Readonly<{
    ANY: ElysiaHandler;
    HEAD: ElysiaHandler;
  }>;
} {
  async function handle(context: { readonly request: Request }): Promise<Response> {
    return app.fetch(context.request);
  }
  async function handleHead(context: { readonly request: Request }): Promise<Response> {
    const { headers: asked, url } = context.request;
    const response = await app.fetch(new Request(url, { headers: asked, method: "GET" }));
    const headers = new Headers(response.headers);
    if (headers.get("content-type")?.startsWith(eventStreamType) === true) {
      void response.body?.cancel();
    } else {
      const body = await response.arrayBuffer();
      headers.set("content-length", String(body.byteLength));
    }
    return new Response(undefined, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
  return {
    handlers: {
      ANY: handle,
      HEAD: handleHead,
    },
  };
}

function failedStatus(failure: Failure): Failed {
  return status(failure.status, { error: failure.message });
}

function unavailableResponse(
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<Response> {
  return runtimeUnavailable(cause, reporting).pipe(
    Effect.map((failure) => jsonResponse({ error: failure.message }, failure.status)),
  );
}

function unavailableStatus(
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<Failed> {
  return runtimeUnavailable(cause, reporting).pipe(Effect.map(failedStatus));
}

function respondRaw<Failures extends Tagged, Requirements>(
  handler: Handler<Response, Failures, Requirements>,
  failures: FailureTable<Exclude<Failures, CommonFailure>>,
): (request: Request) => Effect.Effect<Response, never, Requirements> {
  return (request) =>
    handler(request).pipe(Effect.catchCause((cause) => failureResponse(failures, cause)));
}

function respondValue<Value, Encoded, Failures extends Tagged, Requirements>(
  response: Schema.Codec<Value, Encoded>,
  handler: Handler<Value, Failures, Requirements>,
  failures: FailureTable<Exclude<Failures, CommonFailure>>,
): (request: Request) => Effect.Effect<Encoded | Failed, never, Requirements> {
  const encode = Schema.encodeEffect(response);
  return (request) =>
    handler(request).pipe(
      Effect.flatMap((value) => Effect.orDie(encode(value))),
      Effect.catchCause((cause) => reportedFailure(failures, cause).pipe(Effect.map(failedStatus))),
    );
}

class EventFeed<Encoded extends ServerSentEvent> implements EventStream<Encoded> {
  private readonly source: AsyncIterator<Encoded>;

  public constructor(events: AsyncIterable<Encoded>) {
    this.source = events[Symbol.asyncIterator]();
  }

  public async next(): Promise<IteratorResult<Encoded, void>> {
    const step = await this.source.next();
    if (step.done === true) {
      return { done: true, value: undefined };
    }
    const frame = sse({ data: step.value.data, event: step.value.event });
    return { done: false, value: { ...step.value, ...frame } };
  }

  public async return(): Promise<IteratorResult<Encoded, void>> {
    await this.source.return?.();
    return { done: true, value: undefined };
  }

  public async throw(): Promise<IteratorResult<Encoded, void>> {
    return this.return();
  }

  public [Symbol.asyncIterator](): this {
    return this;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.return();
  }
}

function openStream<Value, Encoded extends ServerSentEvent, Failures extends Tagged, Requirements>(
  event: Schema.Codec<Value, Encoded>,
  handler: Handler<Stream.Stream<Value, never, Requirements>, Failures, Requirements>,
  failures: FailureTable<Exclude<Failures, CommonFailure>>,
): (
  request: Request,
) => Effect.Effect<EventStream<Encoded | FailedEvent> | Failed, never, Requirements> {
  const encode = Schema.encodeEffect(event);
  return (request) =>
    handler(request).pipe(
      Effect.flatMap((values) =>
        Stream.toAsyncIterableEffect(
          Stream.mapEffect(values, (value) => Effect.orDie(encode(value))).pipe(
            Stream.catchCause((cause) =>
              Stream.fromEffect(
                reportedFailure(failures, cause).pipe(
                  Effect.map((failure): FailedEvent => ({
                    data: { message: failure.message, status: failure.status },
                    event: "failed",
                  })),
                ),
              ),
            ),
          ),
        ),
      ),
      Effect.map((events) => new EventFeed(events)),
      Effect.catchCause((cause) => reportedFailure(failures, cause).pipe(Effect.map(failedStatus))),
    );
}

const streamHeaders = { "cache-control": "no-store", "content-encoding": "identity" };

function apiRoutes<Requirements>(
  runtime: WorkerRuntime<Requirements, unknown>,
  reporting: Reporting,
): ApiRoutes<Requirements> {
  async function settle<Value>(
    context: { readonly request: Request },
    program: (request: Request) => Effect.Effect<Value, never, Requirements>,
    unavailable: (cause: Readonly<Cause.Cause<unknown>>) => Effect.Effect<Value>,
  ): Promise<Value> {
    const exit = await runtime.runPromiseExit(program(context.request));
    return Exit.isSuccess(exit) ? exit.value : Effect.runPromise(unavailable(exit.cause));
  }
  function raw<Failures extends Tagged>(
    handler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): ElysiaHandler {
    return async (context): Promise<Response> =>
      settle(context, respondRaw(handler, failures), (cause) =>
        unavailableResponse(cause, reporting),
      );
  }
  function route<Value, Encoded, Failures extends Tagged>(
    response: Schema.Codec<Value, Encoded>,
    handler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): (context: Context) => Promise<Encoded | Failed> {
    return async (context): Promise<Encoded | Failed> =>
      settle(context, respondValue(response, handler, failures), (cause) =>
        unavailableStatus(cause, reporting),
      );
  }
  function events<Value, Encoded extends ServerSentEvent, Failures extends Tagged>(
    event: Schema.Codec<Value, Encoded>,
    handler: Handler<Stream.Stream<Value, never, Requirements>, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ): (context: Context) => Promise<EventStream<Encoded | FailedEvent> | Failed> {
    const open = openStream(event, handler, failures);
    return async (context): Promise<EventStream<Encoded | FailedEvent> | Failed> => {
      const opened = await settle(context, open, (cause) => unavailableStatus(cause, reporting));
      if (opened instanceof EventFeed) {
        Object.assign(context.set.headers, streamHeaders);
      }
      return opened;
    };
  }
  return { events, raw, route };
}

export { AppOrigin } from "./app-origin.ts";
export { Assets } from "./assets.ts";
export { InputInvalid } from "./input-invalid.ts";
export { jsonResponse, secureResponse } from "./responses.ts";
export { apiRoot, apiRoutes, createApi, elysiaServer, readJsonBody, readSearchParams };
export type { ApiRoutes };
export type { Failure, FailureTable } from "./failures.ts";
