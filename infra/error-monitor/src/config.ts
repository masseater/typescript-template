import * as v from "valibot";

const schema = v.object({
  CLOUDFLARE_ACCOUNT_ID: v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/)),
  OBSERVABILITY_TOKEN: v.pipe(v.string(), v.minLength(20)),
});

export type ErrorMonitorConfig = v.InferOutput<typeof schema>;

export function parseErrorMonitorConfig(input: unknown): ErrorMonitorConfig {
  const result = v.safeParse(schema, input);
  if (!result.success) throw new Error("error_monitor_config_invalid");
  return result.output;
}
