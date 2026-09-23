import { isWikiPath, readJobs } from "@repo/config";
import { consumeJobs } from "@repo/runtime/jobs";
import { serveApp, startRoute, withQueue } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { Effect } from "effect";

import { forwardWiki, reporting, runtime } from "#shared/server-api/index.ts";
import { Process } from "#shared/transcription/index.ts";

const start = startRoute(handler);

export { Process };

export default withQueue(
  serveApp({
    runtime,
    route: (request, path) => (isWikiPath(path) ? forwardWiki(request, path) : start(request)),
    reporting,
  }),
  (batch, environment) =>
    Effect.runPromise(
      Effect.gen(function* consume() {
        const jobs = yield* readJobs(environment);
        yield* Effect.promise(() => consumeJobs(batch, jobs));
      }).pipe(Effect.orDie),
    ),
);
