import handler from "@tanstack/react-start/server-entry";
import { handleAuthRequest, verifySession } from "@template/auth";
import { authorizeMcpRequest } from "@template/auth/mcp";
import { reportFailure } from "@template/observability";
import { AppOrigin, Assets, jsonResponse, secureResponse } from "@template/runtime/http";
import { wikiLayer } from "@template/runtime/wiki";
import { requestPath, serveWorker } from "@template/runtime/worker";
import { env } from "cloudflare:workers";
import { Cause, Effect, ManagedRuntime } from "effect";
import { dispatchWikiApi, wikiApi } from "./api.ts";
import { handleMcp } from "./lib/mcp.ts";
import { routes } from "./telemetry-routes.ts";

const runtime = ManagedRuntime.make(wikiLayer(env, routes));
const publicPaths = new Set([
  "/login",
  "/consent",
  "/api/telemetry",
  "/api/health",
  "/api/session",
]);

const reader = (request: Request) =>
  verifySession(request.headers, true).pipe(
    Effect.catchTags({
      SessionRequired: () => Effect.succeed(null),
      SessionInvalid: () => Effect.succeed(null),
      AdminRequired: () => Effect.succeed(null),
      AdminMfaRequired: () => Effect.succeed(null),
    }),
  );

const route = Effect.fn("wikiRoute")(function* (request: Request) {
  const path = requestPath(request);
  if (path === undefined) return new Response(null, { status: 400 });
  if (path.endsWith(".map")) return new Response(null, { status: 404 });
  if (path.startsWith("/assets/"))
    return yield* Assets.use((assets) => Effect.promise(() => assets.fetch(request)));
  if (path.startsWith("/.well-known/oauth-"))
    return secureResponse(yield* handleAuthRequest(request));
  if (path === "/mcp") {
    const authorized = yield* authorizeMcpRequest(request, yield* AppOrigin);
    if (authorized instanceof Response) return authorized;
    return secureResponse(yield* handleMcp(request));
  }
  if (!publicPaths.has(path) && !path.startsWith("/api/auth/")) {
    const current = yield* reader(request);
    if (!current || (!current.strong && path !== "/security")) {
      if (path.startsWith("/api/") || path.startsWith("/_serverFn/"))
        return jsonResponse({ error: "ログインしてください。" }, 401);
      return new Response(null, {
        status: 302,
        headers: { location: current ? "/security" : "/login", "cache-control": "no-store" },
      });
    }
  }
  if (path.startsWith("/api/")) return yield* dispatchWikiApi(wikiApi, request);
  return secureResponse(yield* Effect.promise(async () => handler.fetch(request)));
});

export default serveWorker(runtime, (request) =>
  route(request).pipe(
    Effect.catch((error) =>
      reportFailure(Cause.fail(error)).pipe(
        Effect.as(jsonResponse({ error: "処理に失敗しました。" }, 500)),
      ),
    ),
  ),
);
