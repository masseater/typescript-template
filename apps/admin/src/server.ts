import handler from "@tanstack/react-start/server-entry";
import { createAppWorker } from "@template/runtime/app";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { enforceAdminAccess, localAccessCookie } from "./access.ts";
import { adminApi, dispatchAdminApi } from "./api.ts";
import { routes } from "./telemetry-routes.ts";

export default createAppWorker({
  env,
  audience: "admin",
  routes,
  handler,
  api: adminApi,
  dispatch: dispatchAdminApi,
  gate: (request) => enforceAdminAccess(request, env).pipe(Effect.orDie),
  finalize: (response) =>
    localAccessCookie(env).pipe(
      Effect.orDie,
      Effect.map((cookie) => {
        if (!cookie) return response;
        const headers = new Headers(response.headers);
        headers.append("set-cookie", cookie);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }),
    ),
});
