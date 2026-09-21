import { apiClient, apiServerClient } from "@repo/runtime/client";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Effect } from "effect";

import type { wikiApi } from "#shared/server-api/index.ts";

type WikiClient = ReturnType<typeof apiClient<typeof wikiApi>>;

const wikiClient = createIsomorphicFn()
  .server((): Promise<WikiClient> =>
    Effect.runPromise(
      Effect.gen(function* wikiServerClient() {
        const [{ wikiApi: app }, { getRequest }] = yield* Effect.promise(() =>
          Promise.all([
            import("#shared/server-api/index.ts"),
            import("@tanstack/react-start/server"),
          ]),
        );
        return apiServerClient(app, { cookie: getRequest().headers.get("cookie") ?? "" });
      }),
    ),
  )
  .client(() => apiClient<typeof wikiApi>());

export { wikiClient };
