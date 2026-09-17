import handler from "@tanstack/react-start/server-entry";
import { verifySession } from "@template/auth";
import { apiResponse, jsonResponse, secureResponse } from "@template/runtime/http";
import { createWikiRuntime } from "@template/runtime/wiki";
import { handleMcp } from "./lib/mcp.ts";
import { createWikiSearch } from "./lib/search.ts";
import { routes } from "./telemetry-routes.ts";

const publicPages = new Set(["/login", "/consent"]);

function isAuthenticationFailure(error: unknown) {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}

export default {
  async fetch(request: Request, bindings: unknown) {
    const runtime = createWikiRuntime(bindings, routes);
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
      if (path === "/api/health")
        return jsonResponse({ ok: true, service: "wiki", release: runtime.config.APP_RELEASE });
      const context = runtime.forRequest(correlation);
      try {
        if (path.startsWith("/api/auth/") || path.startsWith("/.well-known/oauth-"))
          return secureResponse(await context.auth.handler(incoming));
        const search = () =>
          createWikiSearch(context.embedder(), (error) => context.reportError(error));
        if (path === "/mcp") {
          const authorized = await context.authorizeMcp(incoming);
          if (authorized instanceof Response) return authorized;
          return secureResponse(await handleMcp(incoming, search()));
        }
        if (path === "/api/session")
          return apiResponse(async () => {
            const { user, strong } = await context.session(incoming, true);
            return {
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                twoFactorEnabled: user.twoFactorEnabled,
              },
              strong,
            };
          }, context.reportError);
        if (!publicPages.has(path)) {
          const reader = await verifySession({
            auth: context.auth,
            database: context.database,
            headers: incoming.headers,
            audience: "wiki",
            allowEnrollment: true,
          }).catch((error: unknown) => {
            if (isAuthenticationFailure(error)) return null;
            throw error;
          });
          if (!reader || (!reader.strong && path !== "/security")) {
            if (path.startsWith("/api/") || path.startsWith("/_serverFn/"))
              return jsonResponse({ error: "ログインしてください。" }, 401);
            return new Response(null, {
              status: 302,
              headers: { location: reader ? "/security" : "/login", "cache-control": "no-store" },
            });
          }
        }
        if (path === "/api/search") {
          const query = new URL(incoming.url).searchParams.get("query")?.trim() ?? "";
          return jsonResponse(query ? await search().search(query.slice(0, 200)) : []);
        }
        return secureResponse(await handler.fetch(incoming));
      } catch (error) {
        context.reportError(error);
        return jsonResponse({ error: "処理に失敗しました。" }, 500);
      }
    });
  },
};
