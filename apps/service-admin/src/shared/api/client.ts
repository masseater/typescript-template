import { apiClient } from "@repo/runtime/client";

import type { adminApi } from "#shared/server-api/index.ts";

function adminClient(): ReturnType<typeof apiClient<typeof adminApi>>["api"] {
  return apiClient<typeof adminApi>().api;
}

export { adminClient };
