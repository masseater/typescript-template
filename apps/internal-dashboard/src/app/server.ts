import { isWikiPath } from "@repo/config";
import { serveApp, startRoute } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";

import { forwardWiki, handleScheduled, reporting, runtime } from "#shared/server-api/index.ts";

const start = startRoute(handler);

const fetchWorker = serveApp({
  runtime,
  route: (request, path) => (isWikiPath(path) ? forwardWiki(request, path) : start(request)),
  reporting,
});

export default {
  fetch: fetchWorker.fetch,
  scheduled: handleScheduled,
};
