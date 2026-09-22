import { apiData } from "@repo/runtime/client";
import { requestAtom } from "@repo/ui";

import { PendingCount } from "#shared/contracts/index.ts";
import { adminClient } from "./client.ts";

function loadPendingCount(): Promise<number> {
  return adminClient()
    .inquiries["pending-count"].get()
    .then((response) => apiData(PendingCount, response).count);
}

const pendingCountAtom = requestAtom(loadPendingCount);

export { pendingCountAtom };
