import handler from "@tanstack/react-start/server-entry";
import { verifySession } from "@template/auth";
import { clientErrorSchema } from "@template/observability";
import { sessionHandler } from "@template/runtime/handlers";
import { createWorker, jsonResponse } from "@template/runtime/http";
import { createWikiRuntime } from "@template/runtime/wiki";
import * as v from "valibot";
import { handleMcp } from "./lib/mcp.ts";
import { createWikiSearch } from "./lib/search.ts";
import { routes } from "./telemetry-routes.ts";

const publicPages = new Set(["/login", "/consent"]);

export default createWorker({
  runtime: (bindings) => createWikiRuntime(bindings, routes),
  async handle(request, { path, runtime, correlation }) {
    if (path === "/api/health")
      return jsonResponse({ ok: true, service: "wiki", release: runtime.config.APP_RELEASE });
    const context = runtime.forRequest(correlation);
    try {
      if (path.startsWith("/api/auth/") || path.startsWith("/.well-known/oauth-"))
        return await context.auth.handler(request);
      const search = () =>
        createWikiSearch(context.embedder(), (error) => context.reportError(error));
      if (path === "/mcp") {
        const authorized = await context.authorizeMcp(request);
        if (authorized instanceof Response) return authorized;
        return await handleMcp(request, search());
      }
      if (path === "/api/session")
        return await sessionHandler({ request, context: { runtime: context, correlation } });
      if (!publicPages.has(path)) {
        const reader = await verifySession({
          auth: context.auth,
          database: context.database,
          headers: request.headers,
          audience: "wiki",
          allowEnrollment: true,
        }).catch((error: unknown) => {
          if (v.is(clientErrorSchema, error)) return null;
          throw error;
        });
        if (!reader || (!reader.strong && path !== "/security")) {
          if (path.startsWith("/api/") || path.startsWith("/_serverFn/"))
            return jsonResponse({ error: "ログインしてください。" }, 401);
          return new Response(null, {
            status: 302,
            headers: { location: reader ? "/security" : "/login" },
          });
        }
      }
      if (path === "/api/search") {
        const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
        return jsonResponse(query ? await search().search(query.slice(0, 200)) : []);
      }
      return await handler.fetch(request);
    } catch (error) {
      context.reportError(error);
      return jsonResponse({ error: "処理に失敗しました。" }, 500);
    }
  },
});
