import handler from "@tanstack/react-start/server-entry";
import { appLayer } from "@template/runtime";
import { Assets, secureResponse } from "@template/runtime/http";
import { requestPath, serveWorker } from "@template/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, ManagedRuntime } from "effect";
import { enforceAdminAccess, localAccessCookie } from "./access.ts";
import { adminApi, dispatchAdminApi } from "./api.ts";
import { routes } from "./telemetry-routes.ts";

const runtime = ManagedRuntime.make(appLayer(env, "admin", routes));

const route = (request: Request) => {
  const path = requestPath(request);
  if (path === undefined) return Effect.succeed(new Response(null, { status: 400 }));
  if (path.endsWith(".map")) return Effect.succeed(new Response(null, { status: 404 }));
  if (path.startsWith("/assets/"))
    return Assets.use((assets) => Effect.promise(() => assets.fetch(request)));
  if (path.startsWith("/api/")) return dispatchAdminApi(adminApi, request);
  return Effect.promise(async () => secureResponse(await handler.fetch(request)));
};

export default serveWorker(runtime, (request) =>
  Effect.gen(function* () {
    const denied = yield* enforceAdminAccess(request, env);
    if (denied) return denied;
    const response = yield* route(request);
    const cookie = yield* localAccessCookie(env);
    if (!cookie) return response;
    const headers = new Headers(response.headers);
    headers.append("set-cookie", cookie);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }).pipe(Effect.orDie),
);
