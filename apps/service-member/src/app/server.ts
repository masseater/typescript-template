import { readJobs } from "@repo/config";
import { Process, consumeJobs } from "@repo/runtime/jobs";
import { appServerEntry, withQueue } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { Effect } from "effect";

import { paraglideMiddleware } from "#paraglide/server.js";
import { UserInbox } from "#shared/inbox/index.ts";
import { reporting, runtime } from "#shared/server-api/index.ts";

const startHandler = {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};

export { Process, UserInbox };

export default withQueue(
  appServerEntry({ runtime, routeHandler: startHandler, reporting }),
  async (batch, environment) =>
    consumeJobs(batch, await Effect.runPromise(Effect.orDie(readJobs(environment)))),
);
