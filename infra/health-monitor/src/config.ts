import {
  array,
  check,
  email,
  maxLength,
  minLength,
  object,
  pipe,
  safeParse,
  string,
  transform,
  url,
} from "valibot";
import type { InferOutput } from "valibot";

type HealthService = "user" | "admin" | "wiki";

interface HealthTarget {
  readonly service: HealthService;
  readonly origin: string;
  readonly guard: string | undefined;
}

const MAX_ALERT_RECIPIENTS = 10;

const origin = pipe(
  string(),
  url(),
  check((value) => {
    const parsed = URL.parse(value);
    return (
      parsed?.protocol === "https:" &&
      parsed.origin === value &&
      parsed.username === "" &&
      parsed.password === ""
    );
  }),
);
const emailAddress = pipe(string(), email());
const schema = object({
  ACCESS_ISSUER: pipe(
    origin,
    check((value) => URL.parse(value)?.hostname.endsWith(".cloudflareaccess.com") === true),
  ),
  ADMIN_ORIGIN: origin,
  ALERT_FROM: emailAddress,
  ALERT_TO: pipe(
    string(),
    transform((value) => value.split(",")),
    array(emailAddress),
    minLength(1),
    maxLength(MAX_ALERT_RECIPIENTS),
  ),
  USER_ORIGIN: origin,
  WIKI_ORIGIN: origin,
});

type HealthMonitorConfig = InferOutput<typeof schema>;
type TargetOrigins = Readonly<
  Pick<HealthMonitorConfig, "ACCESS_ISSUER" | "ADMIN_ORIGIN" | "USER_ORIGIN" | "WIKI_ORIGIN">
>;

function parseHealthMonitorConfig(input: unknown): HealthMonitorConfig {
  const result = safeParse(schema, input);
  if (!result.success) {
    throw new Error("health_monitor_config_invalid");
  }
  const config = result.output;
  const origins = [config.USER_ORIGIN, config.ADMIN_ORIGIN, config.WIKI_ORIGIN];
  if (new Set(origins).size !== origins.length) {
    throw new Error("health_monitor_origins_must_differ");
  }
  return config;
}

function healthTargets(config: TargetOrigins): HealthTarget[] {
  return [
    { guard: undefined, origin: config.USER_ORIGIN, service: "user" },
    { guard: config.ACCESS_ISSUER, origin: config.ADMIN_ORIGIN, service: "admin" },
    { guard: undefined, origin: config.WIKI_ORIGIN, service: "wiki" },
  ];
}

export { healthTargets, parseHealthMonitorConfig };
export type { HealthMonitorConfig, HealthService, HealthTarget };
