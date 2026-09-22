import { purgeExpiredWithdrawnMembers } from "@repo/db";
import { appServerEntry } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { DateTime, Effect } from "effect";

import { paraglideMiddleware } from "#paraglide/server.js";
import { reporting, runtime } from "#shared/server-api/index.ts";

const startHandler = {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};

const fetchWorker = appServerEntry(runtime, startHandler, reporting);

export default {
  fetch: fetchWorker.fetch.bind(fetchWorker),
  scheduled: (
    _controller: unknown,
    _environment: unknown,
    context: { waitUntil(promise: Promise<unknown>): void },
  ): void => {
    context.waitUntil(
      runtime.runPromise(
        Effect.gen(function* () {
          const now = yield* Effect.map(DateTime.now, DateTime.toDate);
          const purged = yield* purgeExpiredWithdrawnMembers(now);
          yield* Effect.log(`member_leave.purged count=${purged.count}`);
        }),
      ),
    );
  },
};
