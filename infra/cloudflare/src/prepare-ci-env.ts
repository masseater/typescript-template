#!/usr/bin/env node
import { appendFile } from "node:fs/promises";

import { runCli } from "@repo/cli";
import { deploymentKeys } from "@repo/observability/deployment-keys";
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
