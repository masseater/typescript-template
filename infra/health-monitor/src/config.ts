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
  ADMIN_ORIGIN: Origin,
  USER_ORIGIN: Origin,
  WIKI_ORIGIN: Origin,
});

type HealthMonitorConfig = typeof HealthMonitorEnvironment.Type;

const APPLICATION_COUNT = 3;

const parseHealthMonitorConfig = Effect.fn("parseHealthMonitorConfig")(
  function* parseHealthMonitorConfig(input: unknown) {
    const config = yield* Schema.decodeUnknownEffect(HealthMonitorEnvironment)(input).pipe(
      Effect.mapError(() => new HealthMonitorFailure({ code: "health_monitor_config_invalid" })),
    );
    if (
      new Set([config.USER_ORIGIN, config.ADMIN_ORIGIN, config.WIKI_ORIGIN]).size !==
      APPLICATION_COUNT
    ) {
      return yield* new HealthMonitorFailure({ code: "health_monitor_origins_must_differ" });
    }
    return config;
  },
);

const healthTargets = (
  config: HealthMonitorConfig,
): readonly [
  { readonly origin: string; readonly service: "user" },
  { readonly origin: string; readonly service: "admin" },
  { readonly origin: string; readonly service: "wiki" },
] => {
  return [
    { origin: config.USER_ORIGIN, service: "user" },
    { origin: config.ADMIN_ORIGIN, service: "admin" },
    { origin: config.WIKI_ORIGIN, service: "wiki" },
  ] as const;
};

export { healthTargets, parseHealthMonitorConfig };
