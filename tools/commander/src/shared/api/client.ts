import type { api } from "#shared/server-api/index.ts";
import { apiClient } from "@repo/runtime/client";

function commanderClient(): ReturnType<typeof apiClient<typeof api>>["api"] {
  return apiClient<typeof api>().api;
}

export { commanderClient };
