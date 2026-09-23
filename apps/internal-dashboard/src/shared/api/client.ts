import { apiClient } from "@repo/runtime/client";
import { requestApiClient } from "@repo/ui/request-client";
import { createIsomorphicFn } from "@tanstack/react-start";

import type { wikiApi } from "#shared/server-api/index.ts";

const wikiClient = createIsomorphicFn()
  .server((): Promise<ReturnType<typeof apiClient<typeof wikiApi>>> =>
    requestApiClient(() => import("#shared/server-api/index.ts").then((module) => module.wikiApi)),
  )
  .client(() => apiClient<typeof wikiApi>());

export { wikiClient };
