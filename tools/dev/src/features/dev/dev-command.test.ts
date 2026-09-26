import { runCommand } from "@repo/cli";
import { recordedRun, subcommandNamesOf } from "@repo/cli/testing";
import { applications } from "@repo/config";
import { describe, expect, test } from "vite-plus/test";

import devPackageConfig from "../../../vite.config.ts";
import { devCommand } from "./dev-command.ts";

describe.for([
  { args: ["restart"], accepted: subcommandNamesOf(devCommand), rejected: "command" },
  { args: ["start", "unknown-app"], accepted: applications, rejected: "application" },
  {
    args: ["ci-runner", "--write", "runner"],
    accepted: subcommandNamesOf(devCommand, "ci-runner"),
    rejected: "ci runner flag",
  },
])("the dev command given an unknown $rejected", ({ args, accepted }) => {
  const it = test.extend("commandRun", () =>
    recordedRun({ args, program: devCommand.pipe(runCommand({ version: "0.0.0" })) }));

  it("fails while parsing without running anything", ({ commandRun }) => {
    expect(commandRun.rejection).toBeDefined();
    expect(commandRun.printed).toStrictEqual([]);
  });

  it("prints every value it accepts in that position", ({ commandRun }) => {
    const usage = commandRun.diagnostics.join("\n");
    expect(accepted).not.toHaveLength(0);
    expect(accepted.filter((name) => !usage.includes(name))).toStrictEqual([]);
  });
});

describe("the tasks of the dev package", () => {
  const it = test.extend("invokedCommands", () =>
    Object.values(devPackageConfig.run?.tasks ?? {}).flatMap((task) => {
      const command = typeof task === "object" && "command" in task ? task.command : undefined;
      const [entry, invoked] = typeof command === "string" ? command.split(" ") : [];
      return entry === "./src/features/dev/cli.ts" && invoked !== undefined ? [invoked] : [];
    }));

  it("invoke only commands the dev command declares", ({ invokedCommands }) => {
    expect(invokedCommands).not.toHaveLength(0);
    expect(
      invokedCommands.filter((invoked) => !subcommandNamesOf(devCommand).includes(invoked)),
    ).toStrictEqual([]);
  });
});
