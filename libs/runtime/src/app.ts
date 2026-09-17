import { Effect, Layer, ManagedRuntime } from "effect";
import type { AnyElysia } from "elysia";
import type { AppServices } from "./index.ts";
import type { Application } from "@template/config";
import type { CurrentRequest } from "@template/observability";
import type { FetchWorker } from "./worker.ts";
import { appLayer } from "./index.ts";
import { secureResponse } from "./responses.ts";
import { serveApp } from "./worker.ts";

interface StartHandler {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly fetch: (request: Request) => Promise<Response> | Response;
}
interface AppWorkerOptions<Extra> {
  readonly env: unknown;
  readonly audience: Exclude<Application, "wiki">;
  readonly routes: Readonly<Record<string, string>>;
  readonly handler: StartHandler;
  readonly api: AnyElysia;
  readonly services: Layer.Layer<Extra, unknown>;
  readonly dispatch: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    app: AnyElysia,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    request: Request,
  ) => Effect.Effect<Response, never, AppServices | Extra | CurrentRequest>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createAppWorker<Extra>(options: AppWorkerOptions<Extra>): FetchWorker {
  const services = appLayer(options.env, options.audience, options.routes);
  const runtime = ManagedRuntime.make(Layer.merge(services, options.services));
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return serveApp(runtime, (request, path) =>
    path.startsWith("/api/")
      ? options.dispatch(options.api, request)
      : Effect.promise(async () => secureResponse(await options.handler.fetch(request))),
  );
}

export { createAppWorker };
