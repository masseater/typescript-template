import { Effect, ManagedRuntime } from "effect";
import type { AnyElysia } from "elysia";
import type { AppServices } from "./index.ts";
import type { Application } from "@template/config";
import type { CurrentRequest } from "@template/observability";
import type { FetchWorker } from "./worker.ts";
import { appLayer } from "./index.ts";
import { secureResponse } from "./responses.ts";
import { serveApp } from "./worker.ts";

interface StartRequestContext {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly fetchApi: (request: Request) => Promise<Response>;
}
interface StartHandler {
  readonly fetch: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    request: Request,
    options: { readonly context: StartRequestContext & { readonly nonce?: string } },
  ) => Promise<Response> | Response;
}
interface AppWorkerOptions {
  readonly env: unknown;
  readonly audience: Exclude<Application, "wiki">;
  readonly routes: Readonly<Record<string, string>>;
  readonly handler: StartHandler;
  readonly api: AnyElysia;
  readonly dispatch: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    app: AnyElysia,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    request: Request,
  ) => Effect.Effect<Response, never, AppServices | CurrentRequest>;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createAppWorker(options: AppWorkerOptions): FetchWorker {
  const runtime = ManagedRuntime.make(appLayer(options.env, options.audience, options.routes));
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return serveApp(runtime, (request, path) =>
    path.startsWith("/api/")
      ? options.dispatch(options.api, request)
      : Effect.gen(function* renderPage() {
          const services = yield* Effect.context<AppServices | CurrentRequest>();
          const context: StartRequestContext = {
            // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
            fetchApi: async (apiRequest) =>
              Effect.runPromise(
                options.dispatch(options.api, apiRequest).pipe(Effect.provide(services)),
              ),
          };
          return yield* Effect.promise(async () =>
            secureResponse(await options.handler.fetch(request, { context })),
          );
        }),
  );
}

export { createAppWorker };
export type { StartRequestContext };
