import { activeGoogleAnalyticsMeasurementId, readEnvironment, readJobs } from "@repo/config";
import { purgeExpiredWithdrawnMembers } from "@repo/db";
import { Process, consumeJobs } from "@repo/runtime/jobs";
import { appServerEntry, withQueue } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";
import { Effect, DateTime } from "effect";

import { paraglideMiddleware } from "#paraglide/server.js";
import { UserInbox } from "#shared/inbox/index.ts";
import { reporting, runtime } from "#shared/server-api/index.ts";

const googleAnalytics =
  Effect.runSync(
    readEnvironment(env).pipe(
      Effect.map(
        (configuration) => activeGoogleAnalyticsMeasurementId(configuration) !== undefined,
      ),
      Effect.orDie,
    ),
  ) === true;

const startHandler = {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};

export { Process, UserInbox };

export default {
  ...withQueue(
    appServerEntry(runtime, startHandler, reporting, { googleAnalytics }),
    (batch, environment) =>
      Effect.runPromise(
        Effect.gen(function* consume() {
          const jobs = yield* readJobs(environment);
          yield* Effect.promise(() => consumeJobs(batch, jobs));
        }).pipe(Effect.orDie),
      ),
  ),
  scheduled: (
    _controller: ScheduledController,
    _environment: unknown,
    context: ExecutionContext,
  ): void => {
    context.waitUntil(
      runtime.runPromise(
        Effect.gen(function* purgeWithdrawnMembers() {
          const purged = yield* purgeExpiredWithdrawnMembers(DateTime.toDate(yield* DateTime.now));
          yield* Effect.log(`member_leave.purged count=${purged.count}`);
        }),
      ),
    );
  },
};
