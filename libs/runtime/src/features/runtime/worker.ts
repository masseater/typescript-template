import { httpStatus } from "@repo/config";
import {
  flushTelemetry,
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
const unavailableResponse = (
  httpRequest: Request,
  failed: {
    readonly cause: Readonly<Cause.Cause<unknown>>;
    readonly reporting: Reporting;
  },
): Promise<Response> =>
  Effect.runPromise(
    runtimeUnavailable(failed.cause, failed.reporting).pipe(
      Effect.map((failure) =>
        secureResponse({
          httpRequest,
          httpResponse: jsonResponse({ error: failure.message }, failure.status),
        }),
      ),
    ),
  );
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
    fetch: (httpRequest, _environment, runtimeContext): Promise<Response> =>
      Effect.runPromise(
        Effect.gen(function* serveFetch() {
          runtimeContext.waitUntil(asked.runtime.built());
          const exit = yield* Effect.promise(() =>
            asked.runtime.runPromiseExit(observeRequest(httpRequest, asked.route)),
          );
          if (exit._tag === "Success") {
            runtimeContext.waitUntil(asked.runtime.runPromise(flushTelemetry));
            return unindexedResponse(exit.value);
          }
          return unindexedResponse(
            yield* Effect.promise(() =>
              unavailableResponse(httpRequest, {
                cause: exit.cause,
                reporting: asked.reporting,
              }),
            ),
          );
        }),
      ),
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
    return yield* Effect.promise(() => assets.fetch(httpRequest));
  });
};
const assetRequest = (httpRequest: Request, assetBase: string): Request => {
  if (assetBase === "") {
    return httpRequest;
  }
  const url = new URL(httpRequest.url);
  return new Request(
    new URL(`${url.pathname.slice(assetBase.length)}${url.search}`, url.origin),
    httpRequest,
  );
};
const serveApp = <Requirements>(asked: {
  readonly runtime: WorkerRuntime<Assets | Requirements | Telemetry | TelemetryFlusher, unknown>;
  readonly route: AppRoute<Requirements>;
  readonly reporting: Reporting;
  readonly assetBase?: string | undefined;
}): FetchWorker => {
  const assetBase = asked.assetBase ?? "";
  const assetPrefix = `${assetBase}/assets/`;
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
      return path.startsWith(assetPrefix)
        ? fetchAsset(assetRequest(httpRequest, assetBase))
        : asked.route(httpRequest, path);
    },
  });
};
type StartHandler = {
  readonly fetch: (httpRequest: Request) => Promise<Response> | Response;
};
const startRoute = (
  routeHandler: StartHandler,
  analyticsSwitch: Readonly<{ googleAnalytics?: boolean }> = {},
): ((httpRequest: Request) => Effect.Effect<Response>) => {
  const googleAnalytics = analyticsSwitch.googleAnalytics === true;
  return (httpRequest) =>
    Effect.gen(function* startRouteProgram() {
      const nonce = createNonce();
      const rendered = new Request(httpRequest);
      rendered.headers.set(cspNonceHeader, nonce);
      return secureResponse({
        httpRequest,
        httpResponse: yield* Effect.promise(() => Promise.resolve(routeHandler.fetch(rendered))),
        nonce,
        googleAnalytics,
      });
    });
};
const appServerEntry = <Requirements>(asked: {
  readonly runtime: WorkerRuntime<Assets | Requirements | Telemetry | TelemetryFlusher, unknown>;
  readonly routeHandler: StartHandler;
  readonly reporting: Reporting;
  readonly googleAnalytics?: boolean;
  readonly assetBase?: string | undefined;
}): FetchWorker => {
  return serveApp({
    runtime: asked.runtime,
    reporting: asked.reporting,
    route: startRoute(asked.routeHandler, { googleAnalytics: asked.googleAnalytics ?? false }),
    assetBase: asked.assetBase,
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
export { configuredSiteLayer } from "./site.ts";
export type { SiteServices } from "./site.ts";
export { workerRuntime } from "./worker-runtime.ts";
export type { AppRoute, FetchWorker, StartHandler };
export type { WorkerRuntime } from "./worker-runtime.ts";
