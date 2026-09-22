#!/usr/bin/env node
import { env as processEnvironment } from "node:process";

import { runCli } from "@repo/cli";
import { deploymentKeys } from "@repo/observability/deployment-keys";
import { Effect, FileSystem } from "effect";

import { PrepareCiEnvFailure, writeCiSecretsFile } from "./ci-env.ts";
import { encodeJson, layer } from "./platform.ts";
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
  return Effect.gen(function* appendOutput() {
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem
      .writeFileString(output, `configured=${configured}\n`, { flag: "a" })
      .pipe(
        Effect.mapError(() => new PrepareCiEnvFailure({ code: "ci_env_unwritable", keys: [] })),
      );
  }).pipe(Effect.provide(layer));
}

runCli(
  Effect.gen(function* program() {
    const environment = processEnvironment;
    const preparation = yield* writeCiSecretsFile(environment);
    if (preparation.status === "unconfigured") {
      if (environment["GITHUB_EVENT_NAME"] === "workflow_dispatch") {
        return yield* new PrepareCiEnvFailure({
          code: "ci_env_incomplete",
          keys: [...deploymentKeys],
        });
      }
      yield* writeOutput(environment, false);
      yield* Effect.log(yield* encodeJson({ event: "cloudflare.ci_env_unconfigured" }));
      return;
    }
    yield* writeOutput(environment, true);
    yield* Effect.log(
      yield* encodeJson({ event: "cloudflare.ci_env_ready", filename: preparation.filename }),
    );
  }),
  (cause) => causeRecord(EVENT, cause),
);
