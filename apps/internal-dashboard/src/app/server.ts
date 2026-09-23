import { appServerEntry } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";

import { handleScheduled, reporting, runtime } from "#shared/server-api/index.ts";

const fetchWorker = appServerEntry(runtime, handler, reporting);

export default {
  fetch: fetchWorker.fetch,
  scheduled: handleScheduled,
};
