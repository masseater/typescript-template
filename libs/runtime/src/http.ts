import type {
  AnyFailureTable,
  ExactFailureTable,
  Failure,
  FailureStatus,
  FailureTable,
  InputKind,
  Tagged,
} from "./failures.ts";
import { Effect, Exit, Schema } from "effect";
import { Elysia, status } from "elysia";
import type { Guard, RouteDetail, RouteSpec } from "./openapi.ts";
import { failureResponse, inputFailures, reportedFailure, runtimeUnavailable } from "./failures.ts";
import { hidden, routeDetail } from "./openapi.ts";
import { httpStatus, readJson } from "@template/observability";
import type { AnyElysia } from "elysia";
import { AppOrigin } from "./app-origin.ts";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import type { Decodable } from "./contracts.ts";
import { InputInvalid } from "./input-invalid.ts";
import type { ManagedRuntime } from "effect";
import type { RequestRejected } from "@template/observability";
import { jsonResponse } from "./responses.ts";

type Handler<Value, Failures, Requirements> = (
  request: Request,
) => Effect.Effect<Value, Failures, Requirements>;
type InputHandler<Input, Value, Failures, Requirements> = (
  request: Request,
  input: Input,
) => Effect.Effect<Value, Failures, Requirements>;
interface ElysiaContext {
  readonly request: Request;
}
type ElysiaHandler = (context: ElysiaContext) => Promise<Response>;
type Failed = ReturnType<typeof status<FailureStatus, { readonly error: string }>>;
interface ApiRoutes<Requirements> {
  readonly guard: <Failures extends Tagged, const Table extends FailureTable<Failures>>(
    check: Handler<unknown, Failures, Requirements>,
    failures: ExactFailureTable<Failures, Table>,
  ) => Guard;
  readonly raw: <Failures extends Tagged, const Table extends FailureTable<Failures>>(
    handler: Handler<Response, Failures, Requirements>,
    failures: ExactFailureTable<Failures, Table>,
  ) => readonly [ElysiaHandler, RouteDetail];
  readonly route: <
    Input extends Decodable,
    Value,
    Encoded,
    Failures extends Tagged,
    const Table extends FailureTable<Failures>,
  >(
    spec: RouteSpec<Input, Value, Encoded>,
    handler: InputHandler<Input["Type"], Value, Failures, Requirements>,
    failures: ExactFailureTable<Failures, Table>,
  ) => readonly [(context: ElysiaContext) => Promise<Encoded | Failed>, RouteDetail];
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

function unavailableResponse(): Response {
  const failure = runtimeUnavailable();
  return jsonResponse({ error: failure.message }, failure.status);
}

function unavailableStatus(): Failed {
  return failedStatus(runtimeUnavailable());
}

function passed(): undefined {
  return undefined;
}

function respondRaw<Failures extends Tagged, Requirements>(
  handler: Handler<Response, Failures, Requirements>,
  failures: AnyFailureTable,
): (request: Request) => Effect.Effect<Response, never, Requirements> {
  return (request) =>
    handler(request).pipe(Effect.catchCause((cause) => failureResponse(failures, cause)));
}

function respondGuard<Failures extends Tagged, Requirements>(
  check: Handler<unknown, Failures, Requirements>,
  failures: AnyFailureTable,
): (request: Request) => Effect.Effect<Response | undefined, never, Requirements> {
  return (request) =>
    check(request).pipe(
      Effect.map(passed),
      Effect.catchCause((cause) => failureResponse(failures, cause)),
    );
}

function respondValue<Value, Encoded, Failures extends Tagged, Requirements>(
  response: Schema.Codec<Value, Encoded>,
  handler: Handler<Value, Failures, Requirements>,
  failures: AnyFailureTable,
): (request: Request) => Effect.Effect<Encoded | Failed, never, Requirements> {
  const encode = Schema.encodeEffect(response);
  return (request) =>
    handler(request).pipe(
      Effect.flatMap((value) => Effect.orDie(encode(value))),
      Effect.catchCause((cause) => reportedFailure(failures, cause).pipe(Effect.map(failedStatus))),
    );
}

function inputKind<Input extends Decodable, Value, Encoded>(
  spec: RouteSpec<Input, Value, Encoded>,
): InputKind {
  if (spec.body !== undefined) {
    return "body";
  }
  return spec.query === undefined ? "none" : "query";
}

function withInput<Input extends Decodable, Value, Encoded, Failures, Requirements>(
  spec: RouteSpec<Input, Value, Encoded>,
  handler: InputHandler<Input["Type"], Value, Failures, Requirements>,
): Handler<Value, Failures | RequestRejected | InputInvalid, Requirements | AppOrigin> {
  const { body, query } = spec;
  if (body !== undefined) {
    return (request) =>
      readJsonBody(body, request).pipe(Effect.flatMap((input) => handler(request, input)));
  }
  if (query !== undefined) {
    return (request) =>
      readSearchParams(query, request).pipe(Effect.flatMap((input) => handler(request, input)));
  }
  return (request) => handler(request, absentInput);
}

function apiRoutes<Requirements>(
  runtime: ManagedRuntime.ManagedRuntime<AppOrigin | Requirements, unknown>,
): ApiRoutes<AppOrigin | Requirements> {
  type Services = AppOrigin | Requirements;
  async function settle<Value>(
    context: ElysiaContext,
    program: (request: Request) => Effect.Effect<Value, never, Services>,
    unavailable: () => Value,
  ): Promise<Value> {
    const exit = await runtime.runPromiseExit(program(context.request));
    return Exit.isSuccess(exit) ? exit.value : unavailable();
  }
  function guard<Failures extends Tagged, const Table extends FailureTable<Failures>>(
    check: Handler<unknown, Failures, Services>,
    failures: ExactFailureTable<Failures, Table>,
  ): Guard {
    const program = respondGuard(check, failures);
    return async (context) => settle(context, program, unavailableResponse);
  }
  function raw<Failures extends Tagged, const Table extends FailureTable<Failures>>(
    handler: Handler<Response, Failures, Services>,
    failures: ExactFailureTable<Failures, Table>,
  ): readonly [ElysiaHandler, RouteDetail] {
    const program = respondRaw(handler, failures);
    return [
      async (context): Promise<Response> => settle(context, program, unavailableResponse),
      hidden,
    ];
  }
  function route<
    Input extends Decodable,
    Value,
    Encoded,
    Failures extends Tagged,
    const Table extends FailureTable<Failures>,
  >(
    spec: RouteSpec<Input, Value, Encoded>,
    handler: InputHandler<Input["Type"], Value, Failures, Services>,
    failures: ExactFailureTable<Failures, Table>,
  ): readonly [(context: ElysiaContext) => Promise<Encoded | Failed>, RouteDetail] {
    const table: AnyFailureTable = { ...inputFailures[inputKind(spec)], ...failures };
    const program = respondValue(spec.response, withInput(spec, handler), table);
    return [
      async (context): Promise<Encoded | Failed> => settle(context, program, unavailableStatus),
      routeDetail(spec, table),
    ];
  }
  return { guard, raw, route };
}

export { AppOrigin } from "./app-origin.ts";
export { Assets } from "./assets.ts";
export { InputInvalid } from "./input-invalid.ts";
export { jsonResponse, secureResponse } from "./responses.ts";
export { apiDocs } from "./openapi.ts";
export { failureBy } from "./failures.ts";
export { apiRoot, apiRoutes, compileApi, createApi, elysiaServer };
export type { ApiRoutes };
export type { Failure, FailureTable } from "./failures.ts";
