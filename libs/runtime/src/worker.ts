import type { Audience } from "@template/db";
import { createRuntime } from "./index.ts";
import type { AppRequestContext } from "./index.ts";
import { secureResponse } from "./http.ts";

type StartHandler = {
  fetch(request: Request, options: { context: AppRequestContext }): Promise<Response> | Response;
};

export function createAppWorker(options: {
  audience: Exclude<Audience, "wiki">;
  routes: Readonly<Record<string, string>>;
  handler: StartHandler;
}) {
  return {
    async fetch(request: Request, bindings: unknown) {
      const runtime = createRuntime(bindings, options.audience, options.routes);
      return runtime.telemetry.wrapRequest(request, async (incoming, correlation) => {
        let path: string;
        try {
          path = decodeURIComponent(new URL(incoming.url).pathname);
        } catch {
          return new Response(null, { status: 400 });
        }
        if (path.endsWith(".map")) return new Response(null, { status: 404 });
        if (path.startsWith("/assets/")) return runtime.config.ASSETS.fetch(incoming);
        if (path === "/api/telemetry") return runtime.telemetry.ingestBrowser(incoming);
        return secureResponse(
          await options.handler.fetch(incoming, {
            context: { runtime: runtime.forRequest(correlation), correlation },
          }),
        );
      });
    },
  };
}
