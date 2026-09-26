#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, runCli, runCommand } from "@repo/cli";
import { Cause, Effect } from "effect";

import { LocalServicesFailure, localCommand } from "./compose-command.ts";

runCli(
  localCommand.pipe(runCommand({ version: "0.0.0" }), Effect.provide(NodeServices.layer)),
  (cause) =>
    causeRecord("local.services_command_failed", {
      cause,
      fields:
        Cause.squash(cause) instanceof LocalServicesFailure
          ? { remediation: "Check the Docker daemon, then retry the requested action." }
          : {},
    }),
);
