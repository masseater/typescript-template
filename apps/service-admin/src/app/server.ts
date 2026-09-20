import { appServerEntry } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "#shared/i18n/server.ts";
import { reporting, runtime } from "#shared/server-api/index.ts";

const startHandler = {
  fetch(request: Request): Promise<Response> {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};

export default appServerEntry(runtime, startHandler, reporting);
