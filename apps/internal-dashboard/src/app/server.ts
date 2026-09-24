import { isWikiPath } from "@repo/config";
import { consumeJobBatch } from "@repo/runtime/jobs";
import { serveApp, startRoute, withQueue } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";

import { forwardWiki, handleScheduled, reporting, runtime } from "#shared/server-api/index.ts";
import { Process } from "#shared/transcription/index.ts";

const start = startRoute(handler);

export { Process };

export default {
  ...withQueue(
    serveApp({
      runtime,
      route: (request, path) => (isWikiPath(path) ? forwardWiki(request, path) : start(request)),
      reporting,
    }),
    consumeJobBatch,
  ),
  scheduled: handleScheduled,
};
