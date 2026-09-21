import { apiClient, apiServerClient } from "@repo/runtime/client";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect } from "effect";

import type { userApi } from "#shared/server-api/index.ts";

type UserClient = ReturnType<typeof apiClient<typeof userApi>>;

const userClient = createIsomorphicFn()
  .server((): Promise<UserClient> =>
    Effect.runPromise(
      Effect.gen(function* userServerClient() {
        const [{ userApi: app }, { getRequest }] = yield* Effect.promise(() =>
          Promise.all([
            import("#shared/server-api/index.ts"),
            import("@tanstack/react-start/server"),
          ]),
        );
        return apiServerClient(app, { cookie: getRequest().headers.get("cookie") ?? "" });
      }),
    ),
  )
  .client(() => apiClient<typeof userApi>());

export { userClient };
