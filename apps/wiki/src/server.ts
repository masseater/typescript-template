import handler from "@tanstack/react-start/server-entry";
import { jsonResponse, secureResponse } from "@template/runtime/http";
import { createWikiRuntime } from "@template/runtime/wiki";
import { handleMcp } from "./lib/mcp.ts";
import { createWikiSearch } from "./lib/search.ts";
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
    const runtime = createWikiRuntime(bindings, routes);
    return runtime.telemetry.wrapRequest(
      request,
      async (incoming, correlation) => {
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
        try {
          const search = createWikiSearch(runtime.embedder(correlation), (error) =>
            runtime.reportError(correlation, error),
          );
          if (path === "/api/search") {
            const query = new URL(incoming.url).searchParams.get("query")?.trim() ?? "";
            return jsonResponse(query ? await search.search(query.slice(0, 200)) : []);
          }
          if (path === "/mcp") return secureResponse(await handleMcp(incoming, search));
          return secureResponse(await handler.fetch(incoming));
        } catch (error) {
          runtime.reportError(correlation, error);
          return jsonResponse({ error: "処理に失敗しました。" }, 500);
        }
      },
      executionContext,
    );
  },
};
