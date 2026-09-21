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
    const config = yield* Schema.decodeUnknownEffect(HealthMonitorEnvironment)(input).pipe(
      Effect.mapError(() => new HealthMonitorFailure({ code: "health_monitor_config_invalid" })),
    );
    const origins = applications.map((service) => config[healthOriginKey[service]]);
    if (!distinctOrigins(origins)) {
      return yield* new HealthMonitorFailure({ code: "health_monitor_origins_must_differ" });
    }
    return config;
  },
);

const healthTargets = (
  config: typeof HealthMonitorEnvironment.Type,
): readonly {
  readonly healthEndpoint: string;
  readonly origin: string;
  readonly service: Application;
}[] =>
  applications.map((service) => {
    const origin = config[healthOriginKey[service]];
    return {
      healthEndpoint: `${origin}/api/health`,
      origin,
      service,
    };
  });

export { HealthMonitorFailure, healthMonitorWorker, healthOriginKey, healthTargets, parseHealthMonitorConfig };
export type { HealthMonitorEnv };
