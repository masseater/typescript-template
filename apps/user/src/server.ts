import handler from "@tanstack/react-start/server-entry";
import { appLayer } from "@template/runtime";
import { Assets, secureResponse } from "@template/runtime/http";
import { requestPath, serveWorker } from "@template/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, ManagedRuntime } from "effect";
import { dispatchUserApi, userApi } from "./api.ts";
import { routes } from "./telemetry-routes.ts";

const runtime = ManagedRuntime.make(appLayer(env, "user", routes));

export default serveWorker(runtime, (request) => {
  const path = requestPath(request);
  if (path === undefined) return Effect.succeed(new Response(null, { status: 400 }));
  if (path.endsWith(".map")) return Effect.succeed(new Response(null, { status: 404 }));
  if (path.startsWith("/assets/"))
    return Assets.use((assets) => Effect.promise(() => assets.fetch(request)));
  if (path.startsWith("/api/")) return dispatchUserApi(userApi, request);
  return Effect.promise(async () => secureResponse(await handler.fetch(request)));
});
