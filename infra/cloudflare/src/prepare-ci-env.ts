#!/usr/bin/env node
import { runCli } from "@repo/config/cli";
import { Effect } from "effect";

import { writeCiSecretsFile } from "./ci-env.ts";
import { causeRecord } from "./secrets.ts";

const EVENT = "cloudflare.ci_env_rejected";

runCli(
  // oxlint-disable-next-line node/no-process-env
  writeCiSecretsFile(process.env).pipe(
    Effect.tap((filename) =>
      Effect.sync(() => {
        console.info(JSON.stringify({ event: "cloudflare.ci_env_ready", filename }));
      }),
    ),
  ),
  (cause) => causeRecord(EVENT, cause),
);
