#!/usr/bin/env node
import { env as processEnvironment } from "node:process";

import { runCli } from "@repo/cli";
import { deploymentKeys } from "@repo/observability/deployment-keys";
import { Effect } from "effect";

import { PrepareCiEnvFailure, writeCiSecretsFile, writeConfiguredOutput } from "./ci-env.ts";
import { encodeJson } from "./platform.ts";
import { causeRecord } from "./secrets.ts";

const EVENT = "cloudflare.ci_env_rejected";

runCli(
  Effect.gen(function* program() {
    const environment = processEnvironment;
    const preparation = yield* writeCiSecretsFile(environment);
    if (preparation.status === "unconfigured") {
      return yield* new PrepareCiEnvFailure({
        code: "ci_env_incomplete",
        keys: [...deploymentKeys],
      });
    }
    yield* writeConfiguredOutput(environment, true);
    yield* Effect.log(
      yield* encodeJson({ event: "cloudflare.ci_env_ready", filename: preparation.filename }),
    );
  }),
  (cause) => causeRecord(EVENT, cause),
);
