import { activeGoogleAnalyticsMeasurementId, readEnvironment } from "@repo/config";
import { purgeExpiredWithdrawnMembers } from "@repo/db";
import { appServerEntry } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";
import { Effect } from "effect";

import { paraglideMiddleware } from "#paraglide/server.js";
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

const fetchWorker = appServerEntry(runtime, startHandler, reporting, { googleAnalytics });

export default {
  fetch: fetchWorker.fetch.bind(fetchWorker),
  scheduled: async (_controller, _environment, context): Promise<void> => {
    context.waitUntil(
      runtime.runPromise(
        Effect.gen(function* purgeWithdrawnMembers() {
          const purged = yield* purgeExpiredWithdrawnMembers(new Date());
          yield* Effect.log(`member_leave.purged count=${purged.count}`);
        }),
      ),
    );
  },
};
