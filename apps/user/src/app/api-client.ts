import { apiClient } from "@template/runtime/client";
import type { userApi } from "./api.ts";

function userClient(): ReturnType<typeof apiClient<typeof userApi>>["api"] {
  return apiClient<typeof userApi>().api;
}

export { userClient };
