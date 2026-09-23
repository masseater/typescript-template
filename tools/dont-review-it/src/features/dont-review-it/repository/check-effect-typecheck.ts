#!/usr/bin/env node
import { causeRecord, markFailed, runCli } from "@repo/cli";
import { runTypecheckGate } from "@repo/vite-config";
import { Console, Effect } from "effect";

const gate = runTypecheckGate({
  cwd: process.cwd(),
  gateArguments: process.argv.slice(2),
});
const transcript = gate.transcript.endsWith("\n") ? gate.transcript.slice(0, -1) : gate.transcript;

runCli(
  Effect.gen(function* reportGate() {
    if (transcript !== "") {
      yield* Console.log(transcript);
    }
    if (gate.exitStatus !== 0) {
      yield* markFailed;
    }
  }),
  (cause) => causeRecord("typecheck.gate_failed", { cause }),
);
