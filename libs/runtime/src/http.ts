import type { CommonFailure, FailureTable, Tagged } from "./failures.ts";
import type { CurrentRequest, RequestRejected } from "@template/observability";
import { Effect, Exit, Schema } from "effect";
import { httpStatus, readJson } from "@template/observability";
import { jsonResponse, secureResponse } from "./responses.ts";
import type { AnyElysia } from "elysia";
import { AppOrigin } from "./app-origin.ts";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import type { Context } from "effect";
import { Elysia } from "elysia";
import { InputInvalid } from "./input-invalid.ts";
import { developmentServer } from "@template/config/mode";
import { failureResponse } from "./failures.ts";

type Decodable = Schema.Top & { readonly DecodingServices: never };
type Handler<Value, Failures, Requirements> = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
) => Effect.Effect<Value, Failures, Requirements | CurrentRequest>;
type ElysiaHandler = (context: Readonly<Record<string, unknown>>) => Promise<Response>;
interface PendingRequest<Requirements> {
  readonly context: Context.Context<Requirements | CurrentRequest>;
  readonly request: Request;
}
type PendingRequests<Requirements> = WeakMap<Request, PendingRequest<Requirements>>;
interface ApiBridge<Requirements> {
  readonly dispatch: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    app: AnyElysia,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    request: Request,
  ) => Effect.Effect<Response, never, Requirements | CurrentRequest>;
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
  return developmentServer
    ? new Elysia({ aot: false })
    : new Elysia({ adapter: CloudflareAdapter });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function compileApi(app: AnyElysia): AnyElysia {
  return developmentServer ? app : app.compile();
}

function dispatcher<Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  pending: PendingRequests<Requirements>,
): ApiBridge<Requirements>["dispatch"] {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (app, request) =>
    Effect.gen(function* dispatchRequest() {
      const routed = new Request(request.url, { headers: request.headers, method: request.method });
      pending.set(routed, {
        context: yield* Effect.context<Requirements | CurrentRequest>(),
        request,
      });
      const response = yield* Effect.promise(async (): Promise<Response> => app.fetch(routed));
      return secureResponse(response);
    });
}

function rawHandler<Requirements>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  pending: PendingRequests<Requirements>,
): ApiBridge<Requirements>["raw"] {
  return (handler, failures) =>
    async ({ request }): Promise<Response> => {
      const entry = request instanceof Request ? pending.get(request) : undefined;
      if (entry === undefined) {
        return jsonResponse({ error: failedMessage }, httpStatus.internalServerError);
      }
      const program = handler(entry.request).pipe(
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
        Effect.catchCause((cause) => failureResponse(failures, cause)),
        Effect.provide(entry.context),
      );
      const exit = await Effect.runPromiseExit(program);
      return Exit.isSuccess(exit)
        ? exit.value
        : jsonResponse({ error: failedMessage }, httpStatus.internalServerError);
    };
}

function routeHandler<Requirements>(
  raw: ApiBridge<Requirements>["raw"],
): ApiBridge<Requirements>["route"] {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (response, handler, failures) => {
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
  };
}

function apiBridge<Requirements>(): ApiBridge<Requirements> {
  const pending: PendingRequests<Requirements> = new WeakMap();
  const raw = rawHandler(pending);
  return { dispatch: dispatcher(pending), raw, route: routeHandler(raw) };
}

export { AppOrigin } from "./app-origin.ts";
export { Assets } from "./assets.ts";
export { InputInvalid } from "./input-invalid.ts";
export { jsonResponse, privateHeaders, secureResponse } from "./responses.ts";
export { apiBridge, compileApi, createApi, readJsonBody, readSearchParams };
export type { ApiBridge };
export type { Failure, FailureTable } from "./failures.ts";
