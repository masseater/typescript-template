#!/usr/bin/env node
import { causeRecord, runCli, runCommand } from "@repo/cli";
import { Effect } from "effect";

import { layer } from "../platform.ts";
import { symbolicateCommand } from "./symbolicate-command.ts";

runCli(
  symbolicateCommand.pipe(
    runCommand({ renderErrors: false, version: "0.0.0" }),
    Effect.provide(layer),
  ),
  (cause) => causeRecord("observe.symbolicate_failed", { cause }),
);
