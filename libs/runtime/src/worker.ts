import { flushTelemetry, httpStatus, observeRequest } from "@repo/observability";
import { cspNonceHeader } from "@repo/runtime/security";
import { Effect, Result } from "effect";

import { Assets } from "./assets.ts";
import { runtimeUnavailable } from "./failures.ts";
import { createNonce, jsonResponse, secureResponse, unindexedResponse } from "./responses.ts";

import type { CurrentRequest, Reporting, Telemetry, TelemetryFlusher } from "@repo/observability";
import type { Cause } from "effect";
import type { WorkerRuntime } from "./worker-runtime.ts";

interface StartHandler {
  readonly fetch: (request: Request) => Promise<Response> | Response;
}
interface FetchWorker {
  readonly fetch: (
    request: Request,
    environment: unknown,
    context: ExecutionContext,
  ) => Promise<Response>;
}
type WorkerRoute<Requirements> = (
  request: Request,
) => Effect.Effect<Response, never, Requirements | Telemetry | CurrentRequest>;
type AppRoute<Requirements> = (
  request: Request,
  path: string,
) => Effect.Effect<Response, never, Requirements | Telemetry | Assets | CurrentRequest>;

function unavailableResponse(
  request: Request,
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Promise<Response> {
  return Effect.runPromise(
    runtimeUnavailable(cause, reporting).pipe(
      Effect.map((failure) =>
        secureResponse(request, jsonResponse({ error: failure.message }, failure.status)),
      ),
    ),
  );
}

function serveWorker<Requirements>(
  runtime: WorkerRuntime<Requirements | Telemetry | TelemetryFlusher, unknown>,
  route: WorkerRoute<Requirements>,
  reporting: Reporting,
): FetchWorker {
  return {
    fetch: (request, _environment, context): Promise<Response> => {
      context.waitUntil(runtime.built());
      return runtime.runPromiseExit(observeRequest(request, route)).then((exit) => {
        if (exit._tag === "Success") {
          context.waitUntil(runtime.runPromise(flushTelemetry));
          return unindexedResponse(exit.value);
        }
        return unavailableResponse(request, exit.cause, reporting).then((response) =>
          unindexedResponse(response),
        );
      });
    },
  };
}

function requestPath(request: Request): string | undefined {
  const pathname = URL.parse(request.url)?.pathname;
  if (pathname === undefined) {
    return undefined;
  }
  const decoded = Result.try(() => decodeURIComponent(pathname));
  return Result.isSuccess(decoded) ? decoded.success : undefined;
}

function fetchAsset(request: Request): Effect.Effect<Response, never, Assets> {
  return Effect.gen(function* fetchAssetProgram() {
    const assets = yield* Assets;
    return yield* Effect.promise(() => assets.fetch(request));
  });
}

function serveApp<Requirements>(
  runtime: WorkerRuntime<Assets | Requirements | Telemetry | TelemetryFlusher, unknown>,
  route: AppRoute<Requirements>,
  reporting: Reporting,
): FetchWorker {
  return serveWorker(
    runtime,
    (request) => {
      const path = requestPath(request);
      if (path === undefined) {
        return Effect.succeed(new Response(undefined, { status: httpStatus.badRequest }));
      }
      if (path.endsWith(".map")) {
        return Effect.succeed(new Response(undefined, { status: httpStatus.notFound }));
      }
      return path.startsWith("/assets/") ? fetchAsset(request) : route(request, path);
    },
    reporting,
  );
}

function appServerEntry<Requirements>(
  runtime: WorkerRuntime<Assets | Requirements | Telemetry | TelemetryFlusher, unknown>,
  handler: StartHandler,
  reporting: Reporting,
): FetchWorker {
  return serveApp(runtime, startRoute(handler), reporting);
}

function withQueue(
  worker: FetchWorker,
  queue: (
    batch: MessageBatch,
    environment: unknown,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    context: ExecutionContext,
  ) => Promise<void>,
): FetchWorker & { readonly queue: typeof queue } {
  return { ...worker, queue };
}

function startRoute(handler: StartHandler): (request: Request) => Effect.Effect<Response> {
  return (request) =>
    Effect.gen(function* startRouteProgram() {
      const nonce = createNonce();
      const rendered = new Request(request);
      rendered.headers.set(cspNonceHeader, nonce);
      return secureResponse(
        request,
        yield* Effect.promise(() => Promise.resolve(handler.fetch(rendered))),
        nonce,
      );
    });
}

export { appServerEntry, serveApp, serveWorker, startRoute, withQueue };
export { workerRuntime } from "./worker-runtime.ts";
export type { AppRoute, FetchWorker };
export type { WorkerRuntime } from "./worker-runtime.ts";
