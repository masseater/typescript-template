import { treaty } from "@elysiajs/eden";
import type { userApi } from "./api.ts";

function userClient(): ReturnType<typeof treaty<typeof userApi>>["api"] {
  return treaty<typeof userApi>(globalThis.location.origin).api;
}

export { userClient };
