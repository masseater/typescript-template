import type { adminApi } from "#server-api/index.ts";
import { apiClient } from "@template/runtime/client";

function adminClient(): ReturnType<typeof apiClient<typeof adminApi>>["api"] {
  return apiClient<typeof adminApi>().api;
}

export { adminClient };
