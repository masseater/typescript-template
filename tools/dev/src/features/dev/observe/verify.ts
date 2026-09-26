#!/usr/bin/env node
import { causeRecord, runCli, runCommand } from "@repo/cli";
import { Effect } from "effect";

import { layer } from "../platform.ts";
import { verifyCommand } from "./verify-command.ts";

runCli(verifyCommand.pipe(runCommand({ version: "0.0.0" }), Effect.provide(layer)), (cause) =>
  causeRecord("observability.verification_failed", {
    cause,
    fields: {
      remediation:
        "Start the application named by --app first. The request must appear in Local Explorer as a structured log and a completed trace.",
    },
  }),
);
