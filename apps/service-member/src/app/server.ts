import { appServerEntry } from "@repo/runtime/worker";
import { UserInbox } from "@repo/user-inbox";
import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "#paraglide/server.js";
import { reporting, runtime } from "#shared/server-api/index.ts";

const startHandler = {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};

export { UserInbox };

export default appServerEntry(runtime, startHandler, reporting);
