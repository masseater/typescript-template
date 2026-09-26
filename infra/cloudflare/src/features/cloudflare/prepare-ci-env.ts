#!/usr/bin/env node
import { runCli } from "@repo/cli";
import { logAt } from "@repo/observability";
import { deploymentKeys } from "@repo/observability/deployment-keys";
import { Effect } from "effect";

import { PrepareCiEnvFailure, writeCiSecretsFile, writeConfiguredOutput } from "./ci-env.ts";
import { causeRecord } from "./secrets.ts";

const EVENT = "cloudflare.ci_env_rejected";

runCli(
  Effect.gen(function* program() {
    const environment = process.env;
    const preparation = yield* writeCiSecretsFile(environment);
    if (preparation.status === "unconfigured") {
      return yield* new PrepareCiEnvFailure({
        code: "ci_env_incomplete",
        keys: [...deploymentKeys],
      });
    }
    yield* writeConfiguredOutput(environment, true);
    yield* logAt("Info", {
      attributes: { filename: preparation.filename },
      eventName: "cloudflare.ci_env_ready",
    });
  }),
  (cause) => causeRecord(EVENT, cause),
);
