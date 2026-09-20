import { activeGoogleAnalyticsMeasurementId, readEnvironment } from "@repo/config";
import { appServerEntry } from "@repo/runtime/worker";
import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";
import { Effect } from "effect";

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

export default appServerEntry(runtime, handler, reporting, { googleAnalytics });
