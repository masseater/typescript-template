#!/usr/bin/env node
import { runCli } from "@repo/cli";
import { logAt } from "@repo/observability";
import { Effect } from "effect";

import { writeCiSecretsFile } from "./ci-env.ts";
import { secretsFile } from "./deployment.ts";
import { projectName } from "./project.ts";
import { causeRecord } from "./secrets.ts";

const EVENT = "cloudflare.env_rejected";

runCli(
  Effect.gen(function* program() {
    const preparation = yield* writeCiSecretsFile(process.env, secretsFile(yield* projectName));
    if (preparation.status === "unconfigured") {
      yield* logAt("Info", { eventName: "cloudflare.env_unconfigured" });
      return;
    }
    yield* logAt("Info", {
      attributes: { filename: preparation.filename },
      eventName: "cloudflare.env_ready",
    });
  }),
  (cause) => causeRecord(EVENT, cause),
);
