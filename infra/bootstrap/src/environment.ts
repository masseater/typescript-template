import { object, optional, parse, string } from "valibot";
import type { InferOutput } from "valibot";

const environmentSchema = object({
  BOOTSTRAP_ACCOUNT_ID: optional(string()),
  BOOTSTRAP_BUCKET: optional(string()),
  CLOUDFLARE_API_TOKEN: optional(string()),
  HOME: optional(string()),
  PATH: optional(string()),
  PULUMI_CONFIG_PASSPHRASE: optional(string()),
  USER: optional(string()),
});

type Environment = InferOutput<typeof environmentSchema>;

function readEnvironment(): Environment {
  // oxlint-disable-next-line node/no-process-env
  return parse(environmentSchema, process.env);
}

export { readEnvironment };
