import type { adminApi } from "./api.ts";
import { treaty } from "@elysiajs/eden";

function adminClient(): ReturnType<typeof treaty<typeof adminApi>>["api"] {
  return treaty<typeof adminApi>(globalThis.location.origin).api;
}

export { adminClient };
