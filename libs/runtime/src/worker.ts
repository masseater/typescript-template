import type { Application } from "@template/config";
import { createRuntime } from "./index.ts";
import type { AppRequestContext } from "./index.ts";
import { createWorker } from "./http.ts";

export function createAppWorker(options: {
  audience: Exclude<Application, "wiki">;
  routes: Readonly<Record<string, string>>;
  handler: {
    fetch(request: Request, options: { context: AppRequestContext }): Promise<Response> | Response;
  };
}) {
  return createWorker({
    runtime: (bindings) => createRuntime(bindings, options.audience, options.routes),
    handle: (request, { runtime, correlation }) =>
      options.handler.fetch(request, {
        context: { runtime: runtime.forRequest(correlation), correlation },
      }),
  });
}
