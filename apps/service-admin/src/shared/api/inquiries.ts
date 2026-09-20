import { apiData } from "@repo/runtime/client";

import { PendingCount } from "#shared/contracts/index.ts";
import { adminClient } from "./client.ts";

async function loadPendingCount(): Promise<number> {
  return apiData(PendingCount, await adminClient().inquiries["pending-count"].get()).count;
}

export { loadPendingCount };
