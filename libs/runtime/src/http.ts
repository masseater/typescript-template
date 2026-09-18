import { httpStatus, readJson, type RequestRejected } from "@template/observability";
import { Effect, Exit, Schema, type ManagedRuntime } from "effect";
import { Elysia, status, type AnyElysia } from "elysia";
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

type Decodable = Schema.Top & { readonly DecodingServices: never };

const decodeInput = <Contract extends Decodable>(
  schema: Contract,
  input: unknown,
): Effect.Effect<Contract["Type"], InputInvalid> => {
  return Schema.decodeUnknownEffect(schema, { onExcessProperty: "error" })(input).pipe(
    Effect.mapError(() => new InputInvalid()),
  );
};

const readSearchParams = <Contract extends Decodable>(
  schema: Contract,
  request: Request,
): Effect.Effect<Contract["Type"], InputInvalid> => {
  return decodeInput(schema, Object.fromEntries(new URL(request.url).searchParams));
};

const apiRoot = "/api";

const createApi = <const Prefix extends string>(prefix: Prefix) => {
  return new Elysia({ adapter: CloudflareAdapter, prefix })
    .onParse(() => unreadBody)
    .onError(({ code }) =>
      code === "NOT_FOUND" ? status(httpStatus.notFound, { error: missingMessage }) : undefined,
    );
};

const compileApi = <App extends AnyElysia>(app: App): App => {
  app.compile();
  return app;
};

type StartMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";

const elysiaServer = (
  app: AnyElysia,
): {
  readonly handlers: Readonly<Record<StartMethod, ElysiaHandler>>;
} => {
  const handle = async (context: ElysiaContext): Promise<Response> => {
    return app.fetch(context.request);
  };
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
};

const failedStatus = (failure: Failure): Failed => {
  return status(failure.status, { error: failure.message });
};

const unavailableResponse = (): Response => {
  const failure = runtimeUnavailable();
  return jsonResponse({ error: failure.message }, failure.status);
};

const unavailableStatus = (): Failed => {
  return failedStatus(runtimeUnavailable());
};

const respondRaw = <Failures extends Tagged, Requirements>(
  handler: Handler<Response, Failures, Requirements>,
  failures: FailureTable<Exclude<Failures, CommonFailure>>,
): ((request: Request) => Effect.Effect<Response, never, Requirements>) => {
  return (request) =>
    handler(request).pipe(Effect.catchCause((cause) => failureResponse(failures, cause)));
};

const respondValue = <Value, Encoded, Failures extends Tagged, Requirements>(
  response: Schema.Codec<Value, Encoded>,
  handler: Handler<Value, Failures, Requirements>,
  failures: FailureTable<Exclude<Failures, CommonFailure>>,
): ((request: Request) => Effect.Effect<Encoded | Failed, never, Requirements>) => {
  const encode = Schema.encodeEffect(response);
  return (request) =>
    handler(request).pipe(
      Effect.flatMap((value) => Effect.orDie(encode(value))),
      Effect.catchCause((cause) => reportedFailure(failures, cause).pipe(Effect.map(failedStatus))),
    );
};

const apiRoutes = <Requirements>(
  runtime: ManagedRuntime.ManagedRuntime<Requirements, unknown>,
): ApiRoutes<Requirements> => {
  const settle = async <Value>(
    context: ElysiaContext,
    program: (request: Request) => Effect.Effect<Value, never, Requirements>,
    unavailable: () => Value,
  ): Promise<Value> => {
    const exit = await runtime.runPromiseExit(program(context.request));
    return Exit.isSuccess(exit) ? exit.value : unavailable();
  };
  const raw = <Failures extends Tagged>(
    handler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): ElysiaHandler => {
    return async (context): Promise<Response> =>
      settle(context, respondRaw(handler, failures), unavailableResponse);
  };
  const route = <Value, Encoded, Failures extends Tagged>(
    response: Schema.Codec<Value, Encoded>,
    handler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): ((context: ElysiaContext) => Promise<Encoded | Failed>) => {
    return async (context): Promise<Encoded | Failed> =>
      settle(context, respondValue(response, handler, failures), unavailableStatus);
  };
  return { raw, route };
};

export { AppOrigin } from "./app-origin.ts";
export { Assets } from "./assets.ts";
export { InputInvalid } from "./input-invalid.ts";
export { jsonResponse, secureResponse } from "./responses.ts";
const readJsonBody = <Contract extends Decodable>(
  schema: Contract,
  request: Request,
): Effect.Effect<Contract["Type"], RequestRejected | InputInvalid, AppOrigin> => {
  return Effect.gen(function* readJsonBodyProgram() {
    const input = yield* readJson({ expectedOrigin: yield* AppOrigin, incoming: request });
    return yield* decodeInput(schema, input);
  });
};

export { apiRoot, apiRoutes, compileApi, createApi, elysiaServer, readJsonBody, readSearchParams };
export type { ApiRoutes };
export type { Failure, FailureTable } from "./failures.ts";
