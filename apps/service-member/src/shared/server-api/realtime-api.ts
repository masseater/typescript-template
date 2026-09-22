import { verifySession } from "@repo/auth";
import { unavailable } from "@repo/runtime/account";
import { createApi } from "@repo/runtime/http";
import { env } from "cloudflare:workers";
import { Effect } from "effect";

import { openRealtime } from "#shared/inbox/index.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const failures = { ...unavailable };
const upgradeRequired = 426;

function realtimeApi(api: ApiRoutes<AppServices>) {
  return createApi("").get(
    "/realtime",
    ...api.raw(
      (request) =>
        Effect.gen(function* handle() {
          const { user } = yield* verifySession(request.headers);
          if (request.headers.get("Upgrade") !== "websocket") {
            return new Response(undefined, {
              status: upgradeRequired,
              statusText: "Upgrade Required",
            });
          }
          return yield* Effect.promise(() => openRealtime(env, user.id, request));
        }),
      failures,
    ),
  );
}

export { realtimeApi };
