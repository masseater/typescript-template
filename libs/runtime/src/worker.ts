import { Effect, Result } from "effect";
import type { Cause, ManagedRuntime } from "effect";

import { cspNonceHeader } from "@repo/config/security";
import type { CurrentRequest, Reporting, Telemetry, TelemetryFlusher } from "@repo/observability";
import { flushTelemetry, httpStatus, observeRequest } from "@repo/observability";

import { Assets } from "./assets.ts";
import { runtimeUnavailable } from "./failures.ts";
import { createNonce, jsonResponse, secureResponse } from "./responses.ts";

interface StartHandler {
  readonly fetch: (request: Request) => Promise<Response> | Response;
}
interface FetchWorker {
  readonly fetch: (
    request: Request,
    environment: unknown,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
  runtime: ManagedRuntime.ManagedRuntime<Requirements | Telemetry | TelemetryFlusher, unknown>,
  route: WorkerRoute<Requirements>,
  reporting: Reporting,
): FetchWorker {
  return {
    fetch: async (request, _environment, context): Promise<Response> => {
      const exit = await runtime.runPromiseExit(observeRequest(request, route));
      if (exit._tag !== "Success") {
        return unavailableResponse(request, exit.cause, reporting);
      }
      context.waitUntil(runtime.runPromise(flushTelemetry));
      return exit.value;
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
  runtime: ManagedRuntime.ManagedRuntime<
    Assets | Requirements | Telemetry | TelemetryFlusher,
    unknown
  >,
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

function startRoute(handler: StartHandler): (request: Request) => Effect.Effect<Response> {
  return (request) =>
    Effect.promise(async () => {
      const nonce = createNonce();
      const rendered = new Request(request);
      rendered.headers.set(cspNonceHeader, nonce);
      return secureResponse(request, await handler.fetch(rendered), nonce);
    });
}

export { serveApp, serveWorker, startRoute };
export type { AppRoute, FetchWorker };
