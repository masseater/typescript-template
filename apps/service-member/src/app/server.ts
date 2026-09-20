import { purgeExpiredWithdrawnMembers } from "@repo/db";
import { appServerEntry } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { Effect } from "effect";

import { reporting, runtime } from "#shared/server-api/index.ts";

const fetchWorker = appServerEntry(runtime, handler, reporting);

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
