import { Console } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { describe, expect, test } from "vite-plus/test";

import { recordedRun } from "./command-test-fixture.ts";
import { runCommand } from "./command.ts";

const reportCommand = Command.make("report", { service: Flag.String("service") }, ({ service }) =>
  Console.log(JSON.stringify({ service })),
);

describe.for([
  {
    args: ["--service", "logs"],
    rejectedWith: undefined,
    stderrWritten: false,
    stdout: ['{"service":"logs"}'],
  },
  {
    args: ["--service", "logs", "--bogus"],
    rejectedWith: "UnrecognizedOption: Unrecognized flag: --bogus in command report",
    stderrWritten: true,
    stdout: [],
  },
  {
    args: [],
    rejectedWith: "MissingOption: Missing required flag: --service",
    stderrWritten: true,
    stdout: [],
  },
])(
  "a command run through runCommand with $args",
  ({ args, rejectedWith, stderrWritten, stdout }) => {
    const it = test.extend("commandRun", () =>
      recordedRun({ args, program: reportCommand.pipe(runCommand({ version: "0.0.0" })) }));

    it("prints only the handler output on stdout", ({ commandRun }) => {
      expect(commandRun.printed).toStrictEqual(stdout);
    });

    it("writes framework output to stderr only when parsing fails", ({ commandRun }) => {
      expect(commandRun.diagnostics.length > 0).toBe(stderrWritten);
    });

    it("fails with the parse error instead of a help request", ({ commandRun }) => {
      expect(commandRun.rejection).toBe(rejectedWith);
    });
  },
);
