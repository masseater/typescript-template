import { activeGoogleAnalyticsMeasurementId, readEnvironment } from "@repo/config";
import { createIsomorphicFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { Effect } from "effect";

const memberMeasurementId = createIsomorphicFn()
  .client((): undefined => undefined)
  .server((): string | undefined =>
    Effect.runSync(
      readEnvironment(env).pipe(Effect.map(activeGoogleAnalyticsMeasurementId), Effect.orDie),
    ),
  );

export { memberMeasurementId };
