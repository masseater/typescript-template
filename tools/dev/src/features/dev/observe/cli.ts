#!/usr/bin/env node
import { causeRecord, runCli, runCommand } from "@repo/cli";
import { Effect } from "effect";

import { layer } from "../platform.ts";
import { observeCommand } from "./query-command.ts";

runCli(observeCommand.pipe(runCommand({ version: "0.0.0" }), Effect.provide(layer)), (cause) =>
  causeRecord("observability.query_failed", { cause }),
);
