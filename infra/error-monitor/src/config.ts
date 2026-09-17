import { minLength, object, pipe, regex, safeParse, string } from "valibot";
import type { InferOutput } from "valibot";

const MIN_OBSERVABILITY_TOKEN_LENGTH = 20;

const schema = object({
  CLOUDFLARE_ACCOUNT_ID: pipe(string(), regex(/^[a-f0-9]{32}$/u)),
  OBSERVABILITY_TOKEN: pipe(string(), minLength(MIN_OBSERVABILITY_TOKEN_LENGTH)),
});

type ErrorMonitorConfig = InferOutput<typeof schema>;

function parseErrorMonitorConfig(input: unknown): ErrorMonitorConfig {
  const result = safeParse(schema, input);
  if (!result.success) {
    throw new Error("error_monitor_config_invalid");
  }
  return result.output;
}

export { parseErrorMonitorConfig };
