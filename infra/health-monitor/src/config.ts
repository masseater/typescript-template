import { Effect, Schema, SchemaGetter } from "effect";

class HealthMonitorFailure extends Schema.TaggedError<HealthMonitorFailure>()(
  "HealthMonitorFailure",
  {
    code: Schema.Literals(["health_monitor_config_invalid", "health_monitor_origins_must_differ"]),
  },
) {}

const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
const Origin = Schema.String.check(
  Schema.makeFilter((value: string) => {
    const url = URL.parse(value);
    return url?.protocol === "https:" && url.origin === value && !url.username && !url.password;
  }),
);
const Recipients = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(Email).check(Schema.isLengthBetween(1, 10)), {
    decode: SchemaGetter.transform((value: string) => value.split(",")),
    encode: SchemaGetter.transform((value: readonly string[]) => value.join(",")),
  }),
);

const HealthMonitorEnvironment = Schema.Struct({
  USER_ORIGIN: Origin,
  ADMIN_ORIGIN: Origin,
  WIKI_ORIGIN: Origin,
  ALERT_FROM: Email,
  ALERT_TO: Recipients,
});

export type HealthMonitorConfig = typeof HealthMonitorEnvironment.Type;

export const parseHealthMonitorConfig = Effect.fn("parseHealthMonitorConfig")(function* (
  input: unknown,
) {
  const config = yield* Schema.decodeUnknownEffect(HealthMonitorEnvironment)(input).pipe(
    Effect.mapError(() => new HealthMonitorFailure({ code: "health_monitor_config_invalid" })),
  );
  if (new Set([config.USER_ORIGIN, config.ADMIN_ORIGIN, config.WIKI_ORIGIN]).size !== 3)
    return yield* new HealthMonitorFailure({ code: "health_monitor_origins_must_differ" });
  return config;
});

export function healthTargets(config: HealthMonitorConfig) {
  return [
    { service: "user", origin: config.USER_ORIGIN },
    { service: "admin", origin: config.ADMIN_ORIGIN },
    { service: "wiki", origin: config.WIKI_ORIGIN },
  ] as const;
}
