import { apiClient } from "@repo/runtime/client";
import { requestApiClient } from "@repo/ui/request-client";
import { createIsomorphicFn } from "@tanstack/react-start";

import type { userApi } from "#shared/server-api/index.ts";

const userClient = createIsomorphicFn()
  .server((): Promise<ReturnType<typeof apiClient<typeof userApi>>> =>
    requestApiClient(() => import("#shared/server-api/index.ts").then((module) => module.userApi)),
  )
  .client(() => apiClient<typeof userApi>());

export { userClient };
