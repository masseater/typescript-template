import { object, optional, parse, string } from "valibot";
import type { InferOutput } from "valibot";

const environmentSchema = object({
  CLOUDFLARE_API_TOKEN: optional(string()),
  PATH: optional(string()),
  PULUMI_NODEJS_TYPESCRIPT: optional(string()),
  TEMPLATE_ENGINE_PROBE: optional(string()),
});

type Environment = InferOutput<typeof environmentSchema>;

function readEnvironment(): Environment {
  // oxlint-disable-next-line node/no-process-env
  return parse(environmentSchema, process.env);
}

export { readEnvironment };
