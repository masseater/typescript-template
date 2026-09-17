import * as v from "valibot";

const origin = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const url = URL.parse(value);
    return url?.protocol === "https:" && url.origin === value && !url.username && !url.password;
  }),
);

const schema = v.object({
  USER_ORIGIN: origin,
  ADMIN_ORIGIN: origin,
  WIKI_ORIGIN: origin,
});

export type HealthMonitorConfig = v.InferOutput<typeof schema>;

export function parseHealthMonitorConfig(input: unknown): HealthMonitorConfig {
  const result = v.safeParse(schema, input);
  if (!result.success) throw new Error("health_monitor_config_invalid");
  const config = result.output;
  if (new Set([config.USER_ORIGIN, config.ADMIN_ORIGIN, config.WIKI_ORIGIN]).size !== 3)
    throw new Error("health_monitor_origins_must_differ");
  return config;
}

export function healthTargets(config: HealthMonitorConfig) {
  return [
    { service: "user", origin: config.USER_ORIGIN },
    { service: "admin", origin: config.ADMIN_ORIGIN },
    { service: "wiki", origin: config.WIKI_ORIGIN },
  ] as const;
}
