import * as pulumi from "@pulumi/pulumi";
import { Effect } from "effect";
import { parseSharedConfig, validateAuthSecret } from "./config.ts";

const config = new pulumi.Config();
export const applicationSettings = Effect.runSync(
  parseSharedConfig(config.requireObject<unknown>("settings")),
);
export const authSecret = config
  .requireSecret("authSecret")
  .apply((value) => Effect.runSync(validateAuthSecret(value)));
