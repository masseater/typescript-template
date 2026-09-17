import type { CommonFailure, FailureTable, Tagged } from "./failures.ts";
import { Effect, Exit, Schema } from "effect";
import { httpStatus, readJson } from "@template/observability";
import type { AnyElysia } from "elysia";
import { AppOrigin } from "./app-origin.ts";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { Elysia } from "elysia";
import { InputInvalid } from "./input-invalid.ts";
import type { ManagedRuntime } from "effect";
import type { RequestRejected } from "@template/observability";
import { developmentServer } from "@template/config/mode";
import { failureResponse } from "./failures.ts";
import { jsonResponse } from "./responses.ts";

type Decodable = Schema.Top & { readonly DecodingServices: never };
type Handler<Value, Failures, Requirements> = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
) => Effect.Effect<Value, Failures, Requirements>;
type ElysiaHandler = (context: Readonly<Record<string, unknown>>) => Promise<Response>;
interface ApiRoutes<Requirements> {
  readonly raw: <Failures extends Tagged>(
    handler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => ElysiaHandler;
  readonly route: <Value, Failures extends Tagged>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    response: Schema.Codec<Value, unknown>,
    handler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ) => ElysiaHandler;
}

const failedMessage = "処理に失敗しました。";
const unparsedBody = { parsed: false } as const;

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

function createApi(): AnyElysia {
  const app = developmentServer
    ? new Elysia({ aot: false })
    : new Elysia({ adapter: CloudflareAdapter });
  return app.onParse(() => unparsedBody);
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

function requestOf(context: Readonly<Record<string, unknown>>): Request | undefined {
  const request: unknown = context["request"];
  return request instanceof Request ? request : undefined;
}

function apiRoutes<Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  runtime: ManagedRuntime.ManagedRuntime<Requirements, unknown>,
): ApiRoutes<Requirements> {
  function raw<Failures extends Tagged>(
    handler: Handler<Response, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): ElysiaHandler {
    return async (context): Promise<Response> => {
      const request = requestOf(context);
      if (request === undefined) {
        return jsonResponse({ error: failedMessage }, httpStatus.internalServerError);
      }
      const exit = await runtime.runPromiseExit(
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
        handler(request).pipe(Effect.catchCause((cause) => failureResponse(failures, cause))),
      );
      return Exit.isSuccess(exit)
        ? exit.value
        : jsonResponse({ error: failedMessage }, httpStatus.internalServerError);
    };
  }
  function route<Value, Failures extends Tagged>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    response: Schema.Codec<Value, unknown>,
    handler: Handler<Value, Failures, Requirements>,
    failures: FailureTable<Exclude<Failures, CommonFailure>>,
  ): ElysiaHandler {
    const encode = Schema.encodeEffect(response);
    return raw(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (request) =>
        handler(request).pipe(
          Effect.flatMap((value) => Effect.orDie(encode(value))),
          Effect.map((body) => jsonResponse(body)),
        ),
      failures,
    );
  }
  return { raw, route };
}

export { AppOrigin } from "./app-origin.ts";
export { Assets } from "./assets.ts";
export { InputInvalid } from "./input-invalid.ts";
export { jsonResponse, privateHeaders, secureResponse } from "./responses.ts";
export { apiRoutes, compileApi, createApi, elysiaServer, readJsonBody, readSearchParams };
export type { ApiRoutes };
export type { Failure, FailureTable } from "./failures.ts";
