import { httpStatus, readJson } from "@template/observability";
import { Effect, Exit, Schema } from "effect";
import { Elysia, status } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";

import { AppOrigin } from "./app-origin.ts";
import { failureResponse, reportedFailure, runtimeUnavailable } from "./failures.ts";
import { InputInvalid } from "./input-invalid.ts";
import { jsonResponse } from "./responses.ts";

import type { RequestRejected } from "@template/observability";
import type { ManagedRuntime } from "effect";
import type { AnyElysia } from "elysia";
import type { CommonFailure, Failure, FailureStatus, FailureTable, Tagged } from "./failures.ts";

type Handler<Value, Failures, Requirements> = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
) => Effect.Effect<Value, Failures, Requirements>;
interface ElysiaContext {
  readonly request: Request;
}
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
type ElysiaHandler = (context: ElysiaContext) => Promise<Response>;
type Failed = ReturnType<typeof status<FailureStatus, { readonly error: string }>>;
interface ApiRoutes<Requirements> {
  readonly raw: <Failures extends Tagged>(
    handler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => ElysiaHandler;
  readonly route: <Value, Encoded, Failures extends Tagged>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    response: Schema.Codec<Value, Encoded>,
    handler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
): Effect.Effect<Contract["Type"], InputInvalid> => {
  return decodeInput(schema, Object.fromEntries(new URL(request.url).searchParams));
};

const apiRoot = "/api";

const createApi = <const Prefix extends string>(prefix: Prefix) => {
  return (
    new Elysia({ adapter: CloudflareAdapter, prefix })
      .onParse(() => unreadBody)
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      .onError(({ code }) =>
        code === "NOT_FOUND" ? status(httpStatus.notFound, { error: missingMessage }) : undefined,
      )
  );
};

const compileApi = <App extends AnyElysia>(app: App): App => {
  app.compile();
  return app;
};

type StartMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
const elysiaServer = (
  app: AnyElysia,
): {
  readonly handlers: Readonly<Record<StartMethod, ElysiaHandler>>;
} => {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
): ((request: Request) => Effect.Effect<Response, never, Requirements>) => {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (request) =>
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    handler(request).pipe(Effect.catchCause((cause) => failureResponse(failures, cause)));
};

const respondValue = <Value, Encoded, Failures extends Tagged, Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  response: Schema.Codec<Value, Encoded>,
  handler: Handler<Value, Failures, Requirements>,
  failures: FailureTable<Exclude<Failures, CommonFailure>>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
): ((request: Request) => Effect.Effect<Encoded | Failed, never, Requirements>) => {
  const encode = Schema.encodeEffect(response);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (request) =>
    handler(request).pipe(
      Effect.flatMap((value) => Effect.orDie(encode(value))),
      Effect.catchCause(
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
        (cause) => reportedFailure(failures, cause).pipe(Effect.map(failedStatus)),
      ),
    );
};

const apiRoutes = <Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  runtime: ManagedRuntime.ManagedRuntime<Requirements, unknown>,
): ApiRoutes<Requirements> => {
  const settle = async <Value>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    context: ElysiaContext,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    return async (context): Promise<Response> =>
      settle(context, respondRaw(handler, failures), unavailableResponse);
  };
  const route = <Value, Encoded, Failures extends Tagged>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    response: Schema.Codec<Value, Encoded>,
    handler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ): ((context: ElysiaContext) => Promise<Encoded | Failed>) => {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
): Effect.Effect<Contract["Type"], RequestRejected | InputInvalid, AppOrigin> => {
  return Effect.gen(function* readJsonBodyProgram() {
    const input = yield* readJson(request, yield* AppOrigin);
    return yield* decodeInput(schema, input);
  });
};

export { apiRoot, apiRoutes, compileApi, createApi, elysiaServer, readJsonBody, readSearchParams };
export type { ApiRoutes };
export type { Failure, FailureTable } from "./failures.ts";
