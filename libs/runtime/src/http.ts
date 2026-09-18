import type { CommonFailure, Failure, FailureStatus, FailureTable, Tagged } from "./failures.ts";
import { Effect, Exit, Schema } from "effect";
import { Elysia, status } from "elysia";
import { failureResponse, reportedFailure, runtimeUnavailable } from "./failures.ts";
import { hidden, routeDetail } from "./openapi.ts";
import { httpStatus, readJson } from "@template/observability";
import type { AnyElysia } from "elysia";
import { AppOrigin } from "./app-origin.ts";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import type { Decodable } from "./contracts.ts";
import { InputInvalid } from "./input-invalid.ts";
import type { ManagedRuntime } from "effect";
import type { RequestRejected } from "@template/observability";
import type { RouteDetail } from "./openapi.ts";
import { jsonResponse } from "./responses.ts";

type Handler<Value, Failures, Requirements> = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
) => Effect.Effect<Value, Failures, Requirements>;
type InputHandler<Input, Value, Failures, Requirements> = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
  input: Input,
) => Effect.Effect<Value, Failures, Requirements>;
type RouteSpec<Input extends Decodable, Value, Encoded> = {
  readonly response: Schema.Codec<Value, Encoded>;
} & (
  | { readonly body: Input; readonly query?: never }
  | { readonly body?: never; readonly query: Input }
  | { readonly body?: never; readonly query?: never }
);
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
  ) => readonly [ElysiaHandler, RouteDetail];
  readonly route: <Input extends Decodable, Value, Encoded, Failures extends Tagged>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    spec: RouteSpec<Input, Value, Encoded>,
    handler: InputHandler<Input["Type"], Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => readonly [
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (context: ElysiaContext) => Promise<Encoded | Failed>,
    RouteDetail,
  ];
}

const missingMessage = "見つかりませんでした。";
const unreadBody = { unread: true } as const;
const absentInput = undefined;

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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
): Effect.Effect<Contract["Type"], RequestRejected | InputInvalid, AppOrigin> {
  return Effect.gen(function* readJsonBodyProgram() {
    const input = yield* readJson(request, yield* AppOrigin);
    return yield* decodeInput(schema, input);
  });
}

function readSearchParams<Contract extends Decodable>(
  schema: Contract,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
): Effect.Effect<Contract["Type"], InputInvalid> {
  return decodeInput(schema, Object.fromEntries(new URL(request.url).searchParams));
}

const apiRoot = "/api";

function createApi<const Prefix extends string>(prefix: Prefix) {
  return (
    new Elysia({ adapter: CloudflareAdapter, prefix })
      .onParse(() => unreadBody)
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      .onError(({ code }) =>
        code === "NOT_FOUND" ? status(httpStatus.notFound, { error: missingMessage }) : undefined,
      )
  );
}

function compileApi<App extends AnyElysia>(app: App): App {
  app.compile();
  return app;
}

type StartMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function elysiaServer(app: AnyElysia): {
  readonly handlers: Readonly<Record<StartMethod, ElysiaHandler>>;
} {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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

function unavailableResponse(): Response {
  const failure = runtimeUnavailable();
  return jsonResponse({ error: failure.message }, failure.status);
}

function unavailableStatus(): Failed {
  return failedStatus(runtimeUnavailable());
}

function respondRaw<Failures extends Tagged, Requirements>(
  handler: Handler<Response, Failures, Requirements>,
  failures: FailureTable<Exclude<Failures, CommonFailure>>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
): (request: Request) => Effect.Effect<Response, never, Requirements> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (request) =>
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    handler(request).pipe(Effect.catchCause((cause) => failureResponse(failures, cause)));
}

function respondValue<Value, Encoded, Failures extends Tagged, Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  response: Schema.Codec<Value, Encoded>,
  handler: Handler<Value, Failures, Requirements>,
  failures: FailureTable<Exclude<Failures, CommonFailure>>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
): (request: Request) => Effect.Effect<Encoded | Failed, never, Requirements> {
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
}

function withInput<Input extends Decodable, Value, Failures, Requirements>(
  spec: { readonly body?: Input; readonly query?: Input },
  handler: InputHandler<Input["Type"], Value, Failures, Requirements>,
): Handler<Value, Failures | RequestRejected | InputInvalid, Requirements | AppOrigin> {
  const { body, query } = spec;
  if (body !== undefined) {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    return (request) =>
      readJsonBody(body, request).pipe(Effect.flatMap((input) => handler(request, input)));
  }
  if (query !== undefined) {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    return (request) =>
      readSearchParams(query, request).pipe(Effect.flatMap((input) => handler(request, input)));
  }
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (request) => handler(request, absentInput);
}

function apiRoutes<Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  runtime: ManagedRuntime.ManagedRuntime<AppOrigin | Requirements, unknown>,
): ApiRoutes<AppOrigin | Requirements> {
  type Services = AppOrigin | Requirements;
  async function settle<Value>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    context: ElysiaContext,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    program: (request: Request) => Effect.Effect<Value, never, Services>,
    unavailable: () => Value,
  ): Promise<Value> {
    const exit = await runtime.runPromiseExit(program(context.request));
    return Exit.isSuccess(exit) ? exit.value : unavailable();
  }
  function raw<Failures extends Tagged>(
    handler: Handler<Response, Failures, Services>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): readonly [ElysiaHandler, RouteDetail] {
    return [
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      async (context): Promise<Response> =>
        settle(context, respondRaw(handler, failures), unavailableResponse),
      hidden,
    ];
  }
  function route<Input extends Decodable, Value, Encoded, Failures extends Tagged>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    spec: RouteSpec<Input, Value, Encoded>,
    handler: InputHandler<Input["Type"], Value, Failures, Services>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ): readonly [(context: ElysiaContext) => Promise<Encoded | Failed>, RouteDetail] {
    const program = respondValue<Value, Encoded, Failures | CommonFailure, Services>(
      spec.response,
      withInput(spec, handler),
      failures,
    );
    return [
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      async (context): Promise<Encoded | Failed> => settle(context, program, unavailableStatus),
      routeDetail(spec, spec.response),
    ];
  }
  return { raw, route };
}

export { AppOrigin } from "./app-origin.ts";
export { Assets } from "./assets.ts";
export { InputInvalid } from "./input-invalid.ts";
export { jsonResponse, secureResponse } from "./responses.ts";
export { apiDocs } from "./openapi.ts";
export { apiRoot, apiRoutes, compileApi, createApi, elysiaServer, readJsonBody, readSearchParams };
export type { ApiRoutes };
export type { Failure, FailureTable } from "./failures.ts";
