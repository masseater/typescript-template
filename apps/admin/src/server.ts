import handler from "@tanstack/react-start/server-entry";
import { createRuntime } from "@template/runtime";
import { secureResponse } from "@template/runtime/http";
import { enforceAdminAccess, localAccessCookie } from "./access.ts";
import { routes } from "./telemetry-routes.ts";

export default {
  async fetch(
    request: Request,
    bindings: unknown,
    executionContext: {
      waitUntil(promise: Promise<unknown>): void;
      passThroughOnException(): void;
    },
  ) {
    const runtime = createRuntime(bindings, "admin", routes);
    return runtime.telemetry.wrapRequest(
      request,
      async (incoming, correlation) => {
        const denied = await enforceAdminAccess(incoming, bindings);
        if (denied) return denied;
        const response = await route(incoming, correlation);
        const cookie = await localAccessCookie(bindings);
        if (!cookie) return response;
        const headers = new Headers(response.headers);
        headers.append("set-cookie", cookie);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      },
      executionContext,
    );

    async function route(incoming: Request, correlation: Parameters<typeof runtime.forRequest>[0]) {
      let path: string;
      try {
        path = decodeURIComponent(new URL(incoming.url).pathname);
      } catch {
        return new Response(null, { status: 400 });
      }
      if (path.endsWith(".map")) return new Response(null, { status: 404 });
      if (path.startsWith("/assets/")) return runtime.config.ASSETS.fetch(incoming);
      if (path === "/api/telemetry")
        return runtime.telemetry.ingestBrowser(incoming, executionContext);
      return secureResponse(
        await handler.fetch(incoming, {
          context: { runtime: runtime.forRequest(correlation), correlation },
        }),
      );
    }
  },
};
