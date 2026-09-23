import { Effect } from "effect";

import { apiServerClient } from "./client.ts";

import type { AnyElysia } from "elysia";

function requestApiClient<App extends AnyElysia>(
  load: () => Promise<App>,
): Promise<ReturnType<typeof apiServerClient<App>>> {
  return Effect.runPromise(
    Effect.gen(function* serverClient() {
      const app = yield* Effect.promise(load);
      const { getRequest } = yield* Effect.promise(() => import("@tanstack/react-start/server"));
      return apiServerClient(app, { cookie: getRequest().headers.get("cookie") ?? "" });
    }),
  );
}

export { requestApiClient };
