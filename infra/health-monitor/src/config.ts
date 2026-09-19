import { Effect, Schema } from "effect";

class HealthMonitorFailure extends Schema.TaggedError<HealthMonitorFailure>()(
  "HealthMonitorFailure",
  {
    code: Schema.Literals(["health_monitor_config_invalid", "health_monitor_origins_must_differ"]),
  },
) {}

const Origin = Schema.String.check(
  Schema.makeFilter((value: string) => {
    const url = URL.parse(value);
    return url?.protocol === "https:" && url.origin === value && !url.username && !url.password;
  }),
);
const HealthMonitorEnvironment = Schema.Struct({
  SERVICE_ADMIN_ORIGIN: Origin,
  SERVICE_MEMBER_ORIGIN: Origin,
  INTERNAL_DASHBOARD_ORIGIN: Origin,
});

type HealthMonitorConfig = typeof HealthMonitorEnvironment.Type;

const APPLICATION_COUNT = 3;

const parseHealthMonitorConfig = Effect.fn("parseHealthMonitorConfig")(
  function* parseHealthMonitorConfig(input: unknown) {
    const config = yield* Schema.decodeUnknownEffect(HealthMonitorEnvironment)(input).pipe(
      Effect.mapError(() => new HealthMonitorFailure({ code: "health_monitor_config_invalid" })),
    );
    if (
      new Set([
        config.SERVICE_MEMBER_ORIGIN,
        config.SERVICE_ADMIN_ORIGIN,
        config.INTERNAL_DASHBOARD_ORIGIN,
      ]).size !== APPLICATION_COUNT
    ) {
      return yield* new HealthMonitorFailure({ code: "health_monitor_origins_must_differ" });
    }
    return config;
  },
);

function healthTargets(
  config: HealthMonitorConfig,
): readonly [
  { readonly origin: string; readonly service: "service-member" },
  { readonly origin: string; readonly service: "service-admin" },
  { readonly origin: string; readonly service: "internal-dashboard" },
] {
  return [
    { origin: config.SERVICE_MEMBER_ORIGIN, service: "service-member" },
    { origin: config.SERVICE_ADMIN_ORIGIN, service: "service-admin" },
    { origin: config.INTERNAL_DASHBOARD_ORIGIN, service: "internal-dashboard" },
  ] as const;
}

export { healthTargets, parseHealthMonitorConfig };
