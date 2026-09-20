<<<<<<< HEAD
import { appServerEntry } from "@repo/runtime/worker";
=======
import { activeGoogleAnalyticsMeasurementId, readEnvironment } from "@repo/config";
import { serveApp, startRoute } from "@repo/runtime/worker";
>>>>>>> 9b49ecfe (Load Google Analytics in the member app with sanitized page paths)
import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";
import { Effect } from "effect";

import { reporting, runtime } from "#shared/server-api/index.ts";

<<<<<<< HEAD
export default appServerEntry(runtime, handler, reporting);
=======
const googleAnalytics =
  Effect.runSync(
    readEnvironment(env).pipe(
      Effect.map(
        (configuration) => activeGoogleAnalyticsMeasurementId(configuration) !== undefined,
      ),
      Effect.orDie,
    ),
  ) === true;

export default serveApp(runtime, startRoute(handler, { googleAnalytics }), reporting);
>>>>>>> 9b49ecfe (Load Google Analytics in the member app with sanitized page paths)
