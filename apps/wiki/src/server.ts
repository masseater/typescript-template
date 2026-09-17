import handler from "@tanstack/react-start/server-entry";

import { Assets, secureResponse } from "@template/runtime/http";
import { wikiLayer } from "@template/runtime/wiki";
import { requestPath, serveWorker } from "@template/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, ManagedRuntime } from "effect";
import { dispatchWikiApi, wikiApi } from "./api.ts";
import { handleMcp } from "./lib/mcp.ts";
import { routes } from "./telemetry-routes.ts";

const runtime = ManagedRuntime.make(wikiLayer(env, routes));

export default serveWorker(runtime, (request) => {
  const path = requestPath(request);
  if (path === undefined) return Effect.succeed(new Response(null, { status: 400 }));
  if (path.endsWith(".map")) return Effect.succeed(new Response(null, { status: 404 }));
  if (path.startsWith("/assets/"))
    return Assets.use((assets) => Effect.promise(() => assets.fetch(request)));
  if (path.startsWith("/api/")) return dispatchWikiApi(wikiApi, request);
  if (path === "/mcp") return handleMcp(request).pipe(Effect.map(secureResponse));
  return Effect.promise(async () => secureResponse(await handler.fetch(request)));
});
