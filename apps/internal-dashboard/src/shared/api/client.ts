import { apiClient, apiServerClient } from "@repo/runtime/client";
import { createIsomorphicFn } from "@tanstack/react-start";

import type { wikiApi } from "#shared/server-api/index.ts";

type WikiClient = ReturnType<typeof apiClient<typeof wikiApi>>;

const wikiClient = createIsomorphicFn()
  .server(async (): Promise<WikiClient> => {
    const [{ wikiApi: app }, { getRequest }] = await Promise.all([
      import("#shared/server-api/index.ts"),
      import("@tanstack/react-start/server"),
    ]);
    return apiServerClient(app, { cookie: getRequest().headers.get("cookie") ?? "" });
  })
  .client(async (): Promise<WikiClient> => apiClient<typeof wikiApi>());

export { wikiClient };
