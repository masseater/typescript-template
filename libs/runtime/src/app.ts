import type { AppRoute, FetchWorker } from "./worker.ts";
import type { AnyElysia } from "elysia";
import type { Assets } from "./assets.ts";
import { Effect } from "effect";
import type { ManagedRuntime } from "effect";
import type { Telemetry } from "@template/observability";
import { compileApi } from "./http.ts";
import { secureResponse } from "./responses.ts";
import { serveApp } from "./worker.ts";

interface StartHandler {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly fetch: (request: Request) => Promise<Response> | Response;
}
interface AppWorkerOptions<Requirements> {
  readonly api: AnyElysia;
  readonly route: AppRoute<Requirements>;
  readonly runtime: ManagedRuntime.ManagedRuntime<Requirements | Telemetry | Assets, unknown>;
}

function startRoute(handler: StartHandler): AppRoute<never> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (request) => Effect.promise(async () => secureResponse(await handler.fetch(request)));
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createAppWorker<Requirements>(options: AppWorkerOptions<Requirements>): FetchWorker {
  compileApi(options.api);
  return serveApp(options.runtime, options.route);
}

export { createAppWorker, startRoute };
