import type { CommonFailure, Failure, FailureTable, Tagged } from "./failures.ts";
import { Effect, Exit, Schema } from "effect";
import { Elysia, status } from "elysia";
import { failureResponse, reportedFailure } from "./failures.ts";
import { httpStatus, readJson } from "@template/observability";
import type { AnyElysia } from "elysia";
import { AppOrigin } from "./app-origin.ts";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { InputInvalid } from "./input-invalid.ts";
import type { ManagedRuntime } from "effect";
import type { RequestRejected } from "@template/observability";
import { developmentServer } from "@template/config/mode";
import { jsonResponse } from "./responses.ts";

type Decodable = Schema.Top & { readonly DecodingServices: never };
type Handler<Value, Failures, Requirements> = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
) => Effect.Effect<Value, Failures, Requirements>;
type ElysiaContext = Readonly<Record<string, unknown>>;
type ElysiaHandler = (context: ElysiaContext) => Promise<Response>;
type SettledStatus =
  | typeof httpStatus.accepted
  | typeof httpStatus.found
  | typeof httpStatus.noContent
  | typeof httpStatus.ok;
type FailureStatus = Exclude<(typeof httpStatus)[keyof typeof httpStatus], SettledStatus>;
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
  ) => (context: ElysiaContext) => Promise<Encoded | Failed>;
}

const failedMessage = "処理に失敗しました。";
const unavailableFailure: Failure = {
  message: failedMessage,
  status: httpStatus.internalServerError,
};
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

function createApi() {
  const app = developmentServer
    ? new Elysia({ aot: false })
    : new Elysia({ adapter: CloudflareAdapter });
  return app.onParse(() => unreadBody);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function compileApi(app: AnyElysia): AnyElysia {
  return developmentServer ? app : app.compile();
}

type StartMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";
interface StartRequest {
  readonly request: Request;
}
interface StartServerRoute {
  readonly handlers: Readonly<
    Record<
      StartMethod,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (context: StartRequest) => Promise<Response>
    >
  >;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function elysiaServer(app: AnyElysia): StartServerRoute {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  async function handle(context: StartRequest): Promise<Response> {
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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return status(failure.status as FailureStatus, { error: failure.message });
}

function requestOf(context: ElysiaContext): Request | undefined {
  const request: unknown = context["request"];
  return request instanceof Request ? request : undefined;
}

function unavailableResponse(): Response {
  return jsonResponse({ error: failedMessage }, httpStatus.internalServerError);
}

function unavailableStatus(): Failed {
  return failedStatus(unavailableFailure);
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

function apiRoutes<Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  runtime: ManagedRuntime.ManagedRuntime<Requirements, unknown>,
): ApiRoutes<Requirements> {
  async function settle<Value>(
    context: ElysiaContext,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    program: (request: Request) => Effect.Effect<Value, never, Requirements>,
    unavailable: () => Value,
  ): Promise<Value> {
    const request = requestOf(context);
    if (request === undefined) {
      return unavailable();
    }
    const exit = await runtime.runPromiseExit(program(request));
    return Exit.isSuccess(exit) ? exit.value : unavailable();
  }
  function raw<Failures extends Tagged>(
    handler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): ElysiaHandler {
    return async (context): Promise<Response> =>
      settle(context, respondRaw(handler, failures), unavailableResponse);
  }
  function route<Value, Encoded, Failures extends Tagged>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    response: Schema.Codec<Value, Encoded>,
    handler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): (context: ElysiaContext) => Promise<Encoded | Failed> {
    return async (context): Promise<Encoded | Failed> =>
      settle(context, respondValue(response, handler, failures), unavailableStatus);
  }
  return { raw, route };
}

export { AppOrigin } from "./app-origin.ts";
export { Assets } from "./assets.ts";
export { InputInvalid } from "./input-invalid.ts";
export { jsonResponse, secureResponse } from "./responses.ts";
export { apiRoutes, compileApi, createApi, elysiaServer, readJsonBody, readSearchParams };
export type { ApiRoutes };
export type { Failure, FailureTable } from "./failures.ts";
