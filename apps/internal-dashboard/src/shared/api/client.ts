import { apiClient, apiServerClient } from "@repo/runtime/client";
import { createIsomorphicFn } from "@tanstack/react-start";

import type { wikiApi } from "#shared/server-api/index.ts";

type DashboardClient = ReturnType<typeof apiClient<typeof wikiApi>>;

const dashboardClient = createIsomorphicFn()
  .server(async (): Promise<DashboardClient> => {
    const [{ wikiApi: app }, { getRequest }] = await Promise.all([
      import("#shared/server-api/index.ts"),
      import("@tanstack/react-start/server"),
    ]);
    return apiServerClient(app, { cookie: getRequest().headers.get("cookie") ?? "" });
  })
  .client(async (): Promise<DashboardClient> => apiClient<typeof wikiApi>());

export { dashboardClient };
