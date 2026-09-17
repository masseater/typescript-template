import {
  array,
  email,
  maxLength,
  minLength,
  object,
  pipe,
  regex,
  safeParse,
  string,
  transform,
} from "valibot";
import type { InferOutput } from "valibot";

const MAX_ALERT_RECIPIENTS = 10;
const MIN_OBSERVABILITY_TOKEN_LENGTH = 20;

const emailAddress = pipe(string(), email());
const schema = object({
  ALERT_FROM: emailAddress,
  ALERT_TO: pipe(
    string(),
    transform((value) => value.split(",")),
    array(emailAddress),
    minLength(1),
    maxLength(MAX_ALERT_RECIPIENTS),
  ),
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
export type { ErrorMonitorConfig };
