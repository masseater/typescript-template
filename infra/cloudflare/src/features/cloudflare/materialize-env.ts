#!/usr/bin/env node
import { runCli } from "@repo/cli";
import { Effect } from "effect";

import { writeCiSecretsFile } from "./ci-env.ts";
import { secretsFile } from "./deployment.ts";
import { encodeJson } from "./platform.ts";
import { projectName } from "./project.ts";
import { causeRecord } from "./secrets.ts";

const EVENT = "cloudflare.env_rejected";

runCli(
  Effect.gen(function* program() {
    const preparation = yield* writeCiSecretsFile(process.env, secretsFile(yield* projectName));
    if (preparation.status === "unconfigured") {
      yield* Effect.log(yield* encodeJson({ event: "cloudflare.env_unconfigured" }));
      return;
    }
    yield* Effect.log(
      yield* encodeJson({ event: "cloudflare.env_ready", filename: preparation.filename }),
    );
  }),
  (cause) => causeRecord(EVENT, cause),
);
