import type { CurrentRequest, Telemetry } from "@template/observability";
import { Effect, Result } from "effect";
import { httpStatus, observeRequest } from "@template/observability";
import { jsonResponse, secureResponse } from "./responses.ts";
import { Assets } from "./assets.ts";
import type { ManagedRuntime } from "effect";
import { runtimeUnavailable } from "./failures.ts";

interface StartHandler {
  readonly fetch: (request: Request) => Promise<Response> | Response;
}
interface FetchWorker {
  readonly fetch: (request: Request) => Promise<Response>;
}
type WorkerRoute<Requirements> = (
  request: Request,
) => Effect.Effect<Response, never, Requirements | Telemetry | CurrentRequest>;
type AppRoute<Requirements> = (
  request: Request,
  path: string,
) => Effect.Effect<Response, never, Requirements | Telemetry | Assets | CurrentRequest>;

function unavailableResponse(): Response {
  const failure = runtimeUnavailable();
  return jsonResponse({ error: failure.message }, failure.status);
}

function serveWorker<Requirements>(
  runtime: ManagedRuntime.ManagedRuntime<Requirements | Telemetry, unknown>,
  route: WorkerRoute<Requirements>,
): FetchWorker {
  return {
    fetch: async (request): Promise<Response> => {
      const exit = await runtime.runPromiseExit(observeRequest(request, route));
      return exit._tag === "Success" ? exit.value : unavailableResponse();
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
  runtime: ManagedRuntime.ManagedRuntime<Requirements | Telemetry | Assets, unknown>,
  route: AppRoute<Requirements>,
): FetchWorker {
  return serveWorker(runtime, (request) => {
    const path = requestPath(request);
    if (path === undefined) {
      return Effect.succeed(new Response(undefined, { status: httpStatus.badRequest }));
    }
    if (path.endsWith(".map")) {
      return Effect.succeed(new Response(undefined, { status: httpStatus.notFound }));
    }
    return path.startsWith("/assets/") ? fetchAsset(request) : route(request, path);
  });
}

function startRoute(handler: StartHandler): (request: Request) => Effect.Effect<Response> {
  return (request) => Effect.promise(async () => secureResponse(await handler.fetch(request)));
}

export { serveApp, serveWorker, startRoute };
export type { AppRoute, FetchWorker };
