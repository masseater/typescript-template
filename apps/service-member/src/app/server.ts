import { activeGoogleAnalyticsMeasurementId, readEnvironment } from "@repo/config";
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

export default appServerEntry(runtime, startHandler, reporting, { googleAnalytics });
