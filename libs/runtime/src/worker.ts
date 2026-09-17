import type { Audience } from "@template/db";
import { createRuntime } from "./index.ts";
import type { AppRequestContext } from "./index.ts";
import { secureResponse } from "./http.ts";

type StartHandler = {
  fetch(request: Request, options: { context: AppRequestContext }): Promise<Response> | Response;
};

export function createAppWorker(options: {
  audience: Audience;
  routes: Readonly<Record<string, string>>;
  handler: StartHandler;
  gate?: (request: Request, bindings: unknown) => Promise<Response | null>;
  finalize?: (response: Response, bindings: unknown) => Promise<Response>;
}) {
  return {
    async fetch(request: Request, bindings: unknown) {
      const runtime = createRuntime(bindings, options.audience, options.routes);
      return runtime.telemetry.wrapRequest(request, async (incoming, correlation) => {
        const denied = await options.gate?.(incoming, bindings);
        if (denied) return denied;
        const response = await route(incoming, correlation);
        return options.finalize ? options.finalize(response, bindings) : response;
      });

      async function route(
        incoming: Request,
        correlation: Parameters<typeof runtime.forRequest>[0],
      ) {
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
      }
    },
  };
}
