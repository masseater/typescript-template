import { apiClient } from "@template/runtime/client";

import type { adminApi } from "#shared/server-api/index.ts";

const adminClient = (): ReturnType<typeof apiClient<typeof adminApi>>["api"] => {
  return apiClient<typeof adminApi>().api;
};

export { adminClient };
