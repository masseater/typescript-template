import { apiClient } from "@repo/runtime/client";

import type { wikiApi } from "#shared/server-api/index.ts";

function wikiClient(): ReturnType<typeof apiClient<typeof wikiApi>>["api"] {
  return apiClient<typeof wikiApi>().api;
}

export { wikiClient };
