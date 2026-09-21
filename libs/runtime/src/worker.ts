import {
  flushTelemetry,
  httpStatus,
  observeRequest,
  type CurrentRequest,
  type Reporting,
  type Telemetry,
  type TelemetryFlusher,
} from "@repo/observability";
import { cspNonceHeader } from "@repo/runtime/security";
import { Effect, Result, type Cause } from "effect";

import { Assets } from "./assets.ts";
import { runtimeUnavailable } from "./failures.ts";
import { createNonce, jsonResponse, secureResponse, unindexedResponse } from "./responses.ts";

import type { WorkerRuntime } from "./worker-runtime.ts";
type AppRoute<Requirements> = (
  httpRequest: Request,
  path: string,
) => Effect.Effect<Response, never, Requirements | Telemetry | Assets | CurrentRequest>;
const unavailableResponse = async (
  httpRequest: Request,
  failed: {
    readonly cause: Readonly<Cause.Cause<unknown>>;
    readonly reporting: Reporting;
  },
): Promise<Response> => {
  const failure = await Effect.runPromise(runtimeUnavailable(failed.cause, failed.reporting));
  return secureResponse({
    httpRequest,
    httpResponse: jsonResponse({ error: failure.message }, failure.status),
  });
};
type FetchWorker = {
  readonly fetch: (
    httpRequest: Request,
    environment: unknown,
    runtimeContext: ExecutionContext,
  ) => Promise<Response>;
};
const serveWorker = <Requirements>(asked: {
  readonly runtime: WorkerRuntime<Requirements | Telemetry | TelemetryFlusher, unknown>;
  readonly route: (
    httpRequest: Request,
  ) => Effect.Effect<Response, never, Requirements | Telemetry | CurrentRequest>;
  readonly reporting: Reporting;
}): FetchWorker => {
  return {
    fetch: async (httpRequest, _environment, runtimeContext): Promise<Response> => {
      runtimeContext.waitUntil(asked.runtime.built());
      const exit = await asked.runtime.runPromiseExit(observeRequest(httpRequest, asked.route));
      if (exit._tag === "Success") {
        runtimeContext.waitUntil(asked.runtime.runPromise(flushTelemetry));
      }
      return unindexedResponse(
        exit._tag === "Success"
          ? exit.value
          : await unavailableResponse(httpRequest, {
              cause: exit.cause,
              reporting: asked.reporting,
            }),
      );
    },
  };
};
const requestPath = (httpRequest: Request): string | undefined => {
  const pathname = URL.parse(httpRequest.url)?.pathname;
  if (pathname === undefined) {
    return undefined;
  }
  const decoded = Result.try(() => decodeURIComponent(pathname));
  return Result.isSuccess(decoded) ? decoded.success : undefined;
};
const fetchAsset = (httpRequest: Request): Effect.Effect<Response, never, Assets> => {
  return Effect.gen(function* fetchAssetProgram() {
    const assets = yield* Assets;
    return yield* Effect.promise(async () => assets.fetch(httpRequest));
  });
};
const serveApp = <Requirements>(asked: {
  readonly runtime: WorkerRuntime<Assets | Requirements | Telemetry | TelemetryFlusher, unknown>;
  readonly route: AppRoute<Requirements>;
  readonly reporting: Reporting;
}): FetchWorker => {
  return serveWorker({
    runtime: asked.runtime,
    reporting: asked.reporting,
    route: (httpRequest) => {
      const path = requestPath(httpRequest);
      if (path === undefined) {
        return Effect.succeed(new Response(undefined, { status: httpStatus.badRequest }));
      }
      if (path.endsWith(".map")) {
        return Effect.succeed(new Response(undefined, { status: httpStatus.notFound }));
      }
      return path.startsWith("/assets/") ? fetchAsset(httpRequest) : asked.route(httpRequest, path);
    },
  });
};
type StartHandler = {
  readonly fetch: (httpRequest: Request) => Promise<Response> | Response;
};
const startRoute = (
  routeHandler: StartHandler,
): ((httpRequest: Request) => Effect.Effect<Response>) => {
  return (httpRequest) =>
    Effect.promise(async () => {
      const nonce = createNonce();
      const rendered = new Request(httpRequest);
      rendered.headers.set(cspNonceHeader, nonce);
      return secureResponse({
        httpRequest,
        httpResponse: await routeHandler.fetch(rendered),
        nonce,
      });
    });
};
const appServerEntry = <Requirements>(asked: {
  readonly runtime: WorkerRuntime<Assets | Requirements | Telemetry | TelemetryFlusher, unknown>;
  readonly routeHandler: StartHandler;
  readonly reporting: Reporting;
}): FetchWorker => {
  return serveApp({
    runtime: asked.runtime,
    reporting: asked.reporting,
    route: startRoute(asked.routeHandler),
  });
};
const withQueue = (
  worker: FetchWorker,
  queue: (
    batch: MessageBatch,
    environment: unknown,
    runtimeContext: ExecutionContext,
  ) => Promise<void>,
): FetchWorker & {
  readonly queue: typeof queue;
} => {
  return { ...worker, queue };
};
export { appServerEntry, serveApp, serveWorker, startRoute, withQueue };
export { workerRuntime } from "./worker-runtime.ts";
export type { AppRoute, FetchWorker };
export type { WorkerRuntime } from "./worker-runtime.ts";
