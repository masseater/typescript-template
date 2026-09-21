import {
  APPLICATION,
  applications,
  distinctOrigins,
  HttpsOrigin,
  type Application,
} from "@repo/config";
import { Effect, Schema } from "effect";

class HealthMonitorFailure extends Schema.TaggedError<HealthMonitorFailure>()(
  "HealthMonitorFailure",
  {
    code: Schema.Literals(["health_monitor_config_invalid", "health_monitor_origins_must_differ"]),
  },
) {}

const healthMonitorWorker = {
  className: "HealthMonitor",
  cron: "37 * * * *",
  event: "health_monitor",
  name: "health",
} as const;

const healthOriginKey = {
  [APPLICATION.wiki]: "INTERNAL_DASHBOARD_ORIGIN",
  [APPLICATION.admin]: "SERVICE_ADMIN_ORIGIN",
  [APPLICATION.user]: "SERVICE_MEMBER_ORIGIN",
} as const satisfies Record<Application, string>;

const HealthMonitorEnvironment = Schema.Struct({
  [healthOriginKey[APPLICATION.wiki]]: HttpsOrigin,
  [healthOriginKey[APPLICATION.admin]]: HttpsOrigin,
  [healthOriginKey[APPLICATION.user]]: HttpsOrigin,
});

type HealthMonitorEnv = typeof HealthMonitorEnvironment.Encoded;

const parseHealthMonitorConfig = Effect.fn("parseHealthMonitorConfig")(
  function* parseHealthMonitorConfig(input: unknown) {
    const acceptedConfig = yield* Schema.decodeUnknownEffect(HealthMonitorEnvironment)(input).pipe(
      Effect.mapError(() => new HealthMonitorFailure({ code: "health_monitor_config_invalid" })),
    );
    const origins = applications.map((serviceName) => acceptedConfig[healthOriginKey[serviceName]]);
    if (!distinctOrigins(origins)) {
      return yield* new HealthMonitorFailure({ code: "health_monitor_origins_must_differ" });
    }
    return acceptedConfig;
  },
);

const healthEndpointFor = (origin: string): string => `${origin}/api/health`;

const healthTargets = (
  acceptedConfig: typeof HealthMonitorEnvironment.Type,
): readonly {
  readonly healthEndpoint: string;
  readonly origin: string;
  readonly service: Application;
}[] =>
  applications.map((serviceName) => {
    const origin = acceptedConfig[healthOriginKey[serviceName]];
    return {
      healthEndpoint: healthEndpointFor(origin),
      origin,
      service: serviceName,
    };
  });

export {
  healthEndpointFor,
  healthMonitorWorker,
  healthOriginKey,
  healthTargets,
  parseHealthMonitorConfig,
};
export type { HealthMonitorEnv };
