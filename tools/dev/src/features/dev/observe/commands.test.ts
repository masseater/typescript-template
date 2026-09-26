import { runCommand } from "@repo/cli";
import { recordedRun, subcommandNamesOf } from "@repo/cli/testing";
import { applications } from "@repo/config";
import { describe, expect, test } from "vite-plus/test";

import { observeCommand } from "./query-command.ts";
import { symbolicateCommand } from "./symbolicate-command.ts";
import { verifyCommand } from "./verify-command.ts";

const observe = observeCommand.pipe(runCommand({ version: "0.0.0" }));
const verify = verifyCommand.pipe(runCommand({ version: "0.0.0" }));
const symbolicate = symbolicateCommand.pipe(runCommand({ version: "0.0.0" }));

describe.for([
  {
    accepted: subcommandNamesOf(observeCommand),
    args: ["latest"],
    program: observe,
    rejected: "an observe query it does not declare",
  },
  {
    accepted: ["--limit", "500"],
    args: ["logs", "--limit", "abc"],
    program: observe,
    rejected: "a limit that is not an integer",
  },
  {
    accepted: ["debug", "info", "log", "warn", "error"],
    args: ["logs", "--level", "verbose"],
    program: observe,
    rejected: "a level it does not know",
  },
  {
    accepted: ["--level", "--limit", "--minutes", "--origin"],
    args: ["logs", "--trace-id", "0123456789abcdef0123456789abcdef"],
    program: observe,
    rejected: "a flag that belongs to another observe query",
  },
  {
    accepted: applications,
    args: [],
    program: verify,
    rejected: "no application to verify",
  },
  {
    accepted: ["--app"],
    args: ["--app", "service-member", "--service", "service-member-server"],
    program: verify,
    rejected: "a service to correlate with",
  },
  {
    accepted: applications,
    args: ["--app", "unknown-app", "--release", "0123456789abcdef", "index.js:1:1"],
    program: symbolicate,
    rejected: "an application it does not know",
  },
])("a development command given $rejected", ({ accepted, args, program }) => {
  const it = test.extend("commandRun", () => recordedRun({ args, program }));

  it("fails while parsing without running anything", ({ commandRun }) => {
    expect(commandRun.rejection).toBeDefined();
    expect(commandRun.printed).toStrictEqual([]);
  });

  it("prints the values it accepts in that position", ({ commandRun }) => {
    const usage = commandRun.diagnostics.join("\n");
    expect(accepted).not.toHaveLength(0);
    expect(accepted.filter((value) => !usage.includes(value))).toStrictEqual([]);
  });
});

describe.for([
  {
    args: ["logs", "--help"],
    shown: ["--level", "--limit", "--minutes", "--origin", "default 100", "default 15"],
    hidden: ["--trace-id", "--request-id"],
  },
  { args: ["trace", "--help"], shown: ["--trace-id", "--origin"], hidden: ["--limit", "--level"] },
  { args: ["request", "--help"], shown: ["--request-id"], hidden: ["--trace-id", "--limit"] },
  {
    args: ["exported", "--help"],
    shown: ["--trace-id", "--minutes"],
    hidden: ["--origin", "--request-id"],
  },
])("the help of observe $args.0", ({ args, hidden, shown }) => {
  const it = test.extend("help", async () =>
    (await recordedRun({ args, program: observe })).diagnostics.join("\n"));

  it("shows the flags the query reads", ({ help }) => {
    expect(shown.filter((flag) => !help.includes(flag))).toStrictEqual([]);
  });

  it("hides the flags of the other queries", ({ help }) => {
    expect(hidden.filter((flag) => help.includes(flag))).toStrictEqual([]);
  });
});
