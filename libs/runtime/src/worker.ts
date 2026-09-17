import type { CurrentRequest, Telemetry } from "@template/observability";
import { observeRequest } from "@template/observability";
import { Effect, Result } from "effect";
import type { ManagedRuntime } from "effect";
import { Assets } from "./http.ts";

export const serveWorker = <R>(
  runtime: ManagedRuntime.ManagedRuntime<R | Telemetry, unknown>,
  route: (request: Request) => Effect.Effect<Response, never, R | Telemetry | CurrentRequest>,
) => ({
  fetch: (request: Request): Promise<Response> =>
    runtime.runPromise(observeRequest(request, route)).catch(() => {
      console.error(JSON.stringify({ event: "application.runtime_unavailable" }));
      return new Response(null, { status: 503, headers: { "cache-control": "no-store" } });
    }),
});

export const serveApp = <R>(
  runtime: ManagedRuntime.ManagedRuntime<R | Telemetry | Assets, unknown>,
  route: (
    request: Request,
    path: string,
  ) => Effect.Effect<Response, never, R | Telemetry | Assets | CurrentRequest>,
) =>
  serveWorker(runtime, (request) => {
    const path = requestPath(request);
    if (path === undefined) return Effect.succeed(new Response(null, { status: 400 }));
    if (path.endsWith(".map")) return Effect.succeed(new Response(null, { status: 404 }));
    if (path.startsWith("/assets/"))
      return Assets.use((assets) => Effect.promise(() => assets.fetch(request)));
    return route(request, path);
  });

function requestPath(request: Request): string | undefined {
  const pathname = URL.parse(request.url)?.pathname;
  if (pathname === undefined) return undefined;
  const decoded = Result.try(() => decodeURIComponent(pathname));
  return Result.isSuccess(decoded) ? decoded.success : undefined;
}
