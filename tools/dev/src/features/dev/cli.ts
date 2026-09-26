#!/usr/bin/env node
import { causeRecord, runCli, runCommand } from "@repo/cli";
import { Cause, Effect } from "effect";

import { devCommand } from "./dev-command.ts";
import { LocalCommandFailure } from "./failure.ts";
import { layer } from "./platform.ts";

runCli(devCommand.pipe(runCommand({ version: "0.0.0" }), Effect.provide(layer)), (cause) =>
  causeRecord("local.application_command_failed", {
    cause,
    fields:
      Cause.squash(cause) instanceof LocalCommandFailure
        ? {
            remediation:
              "Check vp run --filter @repo/dev setup, vp run --filter @repo/db-local db:migrate:local, vp run --filter @repo/dev operator, local configuration permissions, build output, tmux and agent-browser doctor. Credentials are never printed.",
          }
        : {},
  }),
);
