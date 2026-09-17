import type { AppRequestContext } from "./index.ts";
import type { Application } from "@template/config";
import { createRuntime } from "./index.ts";
import { createWorker } from "./http.ts";

type StartOptions = Readonly<{ context: AppRequestContext }>;

interface StartHandler {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly fetch: (request: Request, options: StartOptions) => Promise<Response> | Response;
}

interface AppWorkerOptions {
  readonly audience: Exclude<Application, "wiki">;
  readonly routes: Readonly<Record<string, string>>;
  readonly handler: StartHandler;
}

function createAppWorker(options: AppWorkerOptions): ReturnType<typeof createWorker> {
  return createWorker({
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    handle: async (request, { correlation, runtime }) =>
      options.handler.fetch(request, {
        context: { correlation, runtime: runtime.forRequest(correlation) },
      }),
    runtime: (bindings: unknown) => createRuntime(bindings, options.audience, options.routes),
  });
}

export { createAppWorker };
