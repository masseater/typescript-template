import { activeGoogleAnalyticsMeasurementId, readEnvironment } from "@repo/config";
import { logAt } from "@repo/observability";
import { Process, consumeJobBatch } from "@repo/runtime/jobs";
import { appServerEntry, withQueue } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";
import { Effect, DateTime } from "effect";

import { paraglideMiddleware } from "#paraglide/server.js";
import { UserInbox } from "#shared/inbox/index.ts";
import { purgeWithdrawnWithPhotos } from "#shared/photo/index.ts";
import { reporting, runtime } from "#shared/server-api/index.ts";

const googleAnalytics = Effect.runSync(
  readEnvironment(env).pipe(
    Effect.map((configuration) => activeGoogleAnalyticsMeasurementId(configuration) !== undefined),
    Effect.orDie,
  ),
);

const startHandler = {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};

export { Process, UserInbox };

export default {
  ...withQueue(
    appServerEntry({ googleAnalytics, reporting, routeHandler: startHandler, runtime }),
    consumeJobBatch,
  ),
  scheduled: (
    _controller: ScheduledController,
    _environment: unknown,
    context: ExecutionContext,
  ): void => {
    context.waitUntil(
      runtime.runPromise(
        Effect.gen(function* purgeWithdrawnMembers() {
          const purged = yield* purgeWithdrawnWithPhotos(DateTime.toDate(yield* DateTime.now));
          yield* logAt("Info", {
            attributes: {
              count: purged.memberIds.length,
              retained: purged.retainedMemberIds.length,
            },
            eventName: "member_leave.purged",
          });
        }),
      ),
    );
  },
};
