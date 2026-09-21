#!/usr/bin/env node
import { runCli } from "@repo/cli";
import { Effect } from "effect";

import { writeCiSecretsFile } from "./ci-env.ts";
import { secretsFile } from "./deployment.ts";
import { projectName } from "./project.ts";
import { causeRecord } from "./secrets.ts";

const EVENT = "cloudflare.env_rejected";

runCli(
  Effect.gen(function* program() {
    // oxlint-disable-next-line node/no-process-env
    const environment = process.env;
    const preparation = yield* writeCiSecretsFile(environment, secretsFile(yield* projectName));
    if (preparation.status === "unconfigured") {
      console.info(JSON.stringify({ event: "cloudflare.env_unconfigured" }));
      return;
    }
    console.info(JSON.stringify({ event: "cloudflare.env_ready", filename: preparation.filename }));
  }),
  (cause) => causeRecord(EVENT, cause),
);
