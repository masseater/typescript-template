import type { CurrentRequest, Telemetry } from "@template/observability";
import { observeRequest } from "@template/observability";
import { Result } from "effect";
import type { Effect, ManagedRuntime } from "effect";

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

export function requestPath(request: Request): string | undefined {
  const pathname = URL.parse(request.url)?.pathname;
  if (pathname === undefined) return undefined;
  const decoded = Result.try(() => decodeURIComponent(pathname));
  return Result.isSuccess(decoded) ? decoded.success : undefined;
}
