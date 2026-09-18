import { createIsomorphicFn } from "@tanstack/react-start";
import { apiClient, apiServerClient } from "@template/runtime/client";

import type { userApi } from "#shared/server-api/index.ts";

type UserClient = ReturnType<typeof apiClient<typeof userApi>>;

const userClient = createIsomorphicFn()
  .server(async (): Promise<UserClient> => {
    const [{ userApi: app }, { getRequest }] = await Promise.all([
      import("#shared/server-api/index.ts"),
      import("@tanstack/react-start/server"),
    ]);
    return apiServerClient(app, { cookie: getRequest().headers.get("cookie") ?? "" });
  })
  .client(async (): Promise<UserClient> => apiClient<typeof userApi>());

export { userClient };
