import { appServerEntry } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";

import { reporting, runtime } from "#shared/server-api/index.ts";
import { handleScheduled } from "#shared/server-api/scheduled.ts";

const fetchWorker = appServerEntry(runtime, handler, reporting);

export default {
  fetch: fetchWorker.fetch,
  scheduled: handleScheduled,
};
