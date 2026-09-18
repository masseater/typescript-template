import type { Cause, ManagedRuntime } from "effect";
import type { CommonFailure, Failure, FailureStatus, FailureTable, Tagged } from "./failures.ts";
import { Effect, Exit, Schema } from "effect";
import { Elysia, status } from "elysia";
import type { Reporting, RequestRejected } from "@repo/observability";
import { failureResponse, reportedFailure, runtimeUnavailable } from "./failures.ts";
import { httpStatus, readJson } from "@repo/observability";
import type { AnyElysia } from "elysia";
import { AppOrigin } from "./app-origin.ts";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { InputInvalid } from "./input-invalid.ts";
import { jsonResponse } from "./responses.ts";

type Decodable = Schema.Top & { readonly DecodingServices: never };
type Handler<Value, Failures, Requirements> = (
  request: Request,
) => Effect.Effect<Value, Failures, Requirements>;
interface ElysiaContext {
  readonly request: Request;
}
type ElysiaHandler = (context: ElysiaContext) => Promise<Response>;
type Failed = ReturnType<typeof status<FailureStatus, { readonly error: string }>>;
interface ApiRoutes<Requirements> {
  readonly raw: <Failures extends Tagged>(
    handler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => ElysiaHandler;
  readonly route: <Value, Encoded, Failures extends Tagged>(
    response: Schema.Codec<Value, Encoded>,
    handler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => (context: ElysiaContext) => Promise<Encoded | Failed>;
}

const missingMessage = "見つかりませんでした。";
const unreadBody = { unread: true } as const;

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
    const input = yield* readJson(request, yield* AppOrigin);
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
  return new Elysia({ adapter: CloudflareAdapter, prefix })
    .onParse(() => unreadBody)
    .onError(({ code }) =>
      code === "NOT_FOUND" ? status(httpStatus.notFound, { error: missingMessage }) : undefined,
    );
}

function compileApi<App extends AnyElysia>(app: App): App {
  app.compile();
  return app;
}

type StartMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";

function elysiaServer(app: AnyElysia): {
  readonly handlers: Readonly<Record<StartMethod, ElysiaHandler>>;
} {
  async function handle(context: ElysiaContext): Promise<Response> {
    return app.fetch(context.request);
  }
  return {
    handlers: {
      DELETE: handle,
      GET: handle,
      HEAD: handle,
      OPTIONS: handle,
      PATCH: handle,
      POST: handle,
      PUT: handle,
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

function apiRoutes<Requirements>(
  runtime: ManagedRuntime.ManagedRuntime<Requirements, unknown>,
  reporting: Reporting,
): ApiRoutes<Requirements> {
  async function settle<Value>(
    context: ElysiaContext,
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
  ): (context: ElysiaContext) => Promise<Encoded | Failed> {
    return async (context): Promise<Encoded | Failed> =>
      settle(context, respondValue(response, handler, failures), (cause) =>
        unavailableStatus(cause, reporting),
      );
  }
  return { raw, route };
}

export { AppOrigin } from "./app-origin.ts";
export { Assets } from "./assets.ts";
export { InputInvalid } from "./input-invalid.ts";
export { jsonResponse, secureResponse } from "./responses.ts";
export { apiRoot, apiRoutes, compileApi, createApi, elysiaServer, readJsonBody, readSearchParams };
export type { ApiRoutes };
export type { Failure, FailureTable } from "./failures.ts";
