import { parseSharedConfig, validateAuthSecret } from "./config.ts";
import { Config } from "@pulumi/pulumi";
import { Effect } from "effect";

const config = new Config();
const applicationSettings = await Effect.runPromise(
  parseSharedConfig(config.requireObject<unknown>("settings")),
);
const authSecret = config
  .requireSecret("authSecret")
  .apply(async (value) => Effect.runPromise(validateAuthSecret(value)));

export { applicationSettings, authSecret };
