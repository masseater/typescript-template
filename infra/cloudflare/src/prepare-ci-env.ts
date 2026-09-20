#!/usr/bin/env node
<<<<<<< HEAD
// oxlint-disable-next-line import/no-nodejs-modules
import { appendFile } from "node:fs/promises";

import { runCli } from "@repo/config/cli";
import { deploymentKeys } from "@repo/config/deployment-keys";
=======
import { runCli } from "@repo/cli";
>>>>>>> 8d5995a7 (fix: clear prepr knip and ownership import regressions)
import { Effect } from "effect";

import { PrepareCiEnvFailure, writeCiSecretsFile } from "./ci-env.ts";
import { causeRecord } from "./secrets.ts";

const EVENT = "cloudflare.ci_env_rejected";

function writeOutput(
  environment: Readonly<Record<string, string | undefined>>,
  configured: boolean,
): Effect.Effect<void, PrepareCiEnvFailure> {
  const output = environment["GITHUB_OUTPUT"];
  if (output === undefined || output === "") {
    return Effect.void;
  }
  return Effect.tryPromise({
    catch: () => new PrepareCiEnvFailure({ code: "ci_env_unwritable", keys: [] }),
    try: async () => appendFile(output, `configured=${configured}\n`),
  });
}

runCli(
  Effect.gen(function* program() {
    // oxlint-disable-next-line node/no-process-env
    const environment = process.env;
    const preparation = yield* writeCiSecretsFile(environment);
    if (preparation.status === "unconfigured") {
      if (environment["GITHUB_EVENT_NAME"] === "workflow_dispatch") {
        return yield* Effect.fail(
          new PrepareCiEnvFailure({ code: "ci_env_incomplete", keys: [...deploymentKeys] }),
        );
      }
      yield* writeOutput(environment, false);
      console.info(JSON.stringify({ event: "cloudflare.ci_env_unconfigured" }));
      return;
    }
    yield* writeOutput(environment, true);
    console.info(
      JSON.stringify({ event: "cloudflare.ci_env_ready", filename: preparation.filename }),
    );
  }),
  (cause) => causeRecord(EVENT, cause),
);
