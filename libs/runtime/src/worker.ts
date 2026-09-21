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

async function unavailableResponse(
  request: Request,
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Promise<Response> {
  const failure = await Effect.runPromise(runtimeUnavailable(cause, reporting));
  return secureResponse(request, jsonResponse({ error: failure.message }, failure.status));
}

function serveWorker<Requirements>(
  runtime: WorkerRuntime<Requirements | Telemetry | TelemetryFlusher, unknown>,
  route: WorkerRoute<Requirements>,
  reporting: Reporting,
): FetchWorker {
  return {
    fetch: async (request, _environment, context): Promise<Response> => {
      context.waitUntil(runtime.built());
      const exit = await runtime.runPromiseExit(observeRequest(request, route));
      if (exit._tag === "Success") {
        context.waitUntil(runtime.runPromise(flushTelemetry));
      }
      return unindexedResponse(
        exit._tag === "Success"
          ? exit.value
          : await unavailableResponse(request, exit.cause, reporting),
      );
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
    return yield* Effect.promise(async () => assets.fetch(request));
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

function startRoute(
  handler: StartHandler,
  options: Readonly<{ googleAnalytics?: boolean }> = {},
): (request: Request) => Effect.Effect<Response> {
  const googleAnalytics = options.googleAnalytics === true;
  return (request) =>
    Effect.promise(async () => {
      const nonce = createNonce();
      const rendered = new Request(request);
      rendered.headers.set(cspNonceHeader, nonce);
      return secureResponse(request, await handler.fetch(rendered), nonce, googleAnalytics);
    });
}

function appServerEntry<Requirements>(
  runtime: WorkerRuntime<Assets | Requirements | Telemetry | TelemetryFlusher, unknown>,
  handler: StartHandler,
  reporting: Reporting,
  options: Readonly<{ googleAnalytics?: boolean }> = {},
): FetchWorker {
  return serveApp(runtime, startRoute(handler, options), reporting);
}

export { appServerEntry, serveApp, serveWorker, startRoute };
export { workerRuntime } from "./worker-runtime.ts";
export type { AppRoute, FetchWorker };
export type { WorkerRuntime } from "./worker-runtime.ts";
