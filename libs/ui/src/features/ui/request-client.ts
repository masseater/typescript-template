import { apiServerClient } from "@repo/runtime/client";
import { Effect } from "effect";

import type { AnyElysia } from "elysia";

const requestApiClient = <App extends AnyElysia>(
  load: () => Promise<App>,
): Promise<ReturnType<typeof apiServerClient<App>>> =>
  Effect.runPromise(
    Effect.gen(function* serverClient() {
      const app = yield* Effect.promise(load);
      const { getRequest } = yield* Effect.promise(() => import("@tanstack/react-start/server"));
      return apiServerClient(app, { cookie: getRequest().headers.get("cookie") ?? "" });
    }),
  );

export { requestApiClient };
