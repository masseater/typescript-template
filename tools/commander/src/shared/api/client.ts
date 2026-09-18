import { apiClient } from "@repo/runtime/client";

import type { api } from "#shared/server-api/index.ts";

function commanderClient(): ReturnType<typeof apiClient<typeof api>>["api"] {
  return apiClient<typeof api>().api;
}

export { commanderClient };
