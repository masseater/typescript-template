import { runCommand } from "@repo/cli";
import { recordedRun, subcommandNamesOf } from "@repo/cli/testing";
import { describe, expect, test } from "vite-plus/test";

import { localCommand } from "./compose-command.ts";

describe("the local services command given an action it does not declare", () => {
  const it = test.extend("commandRun", () =>
    recordedRun({
      args: ["restart"],
      program: localCommand.pipe(runCommand({ version: "0.0.0" })),
    }));

  it("lists every action it declares", ({ commandRun }) => {
    const usage = commandRun.diagnostics.join("\n");
    expect(subcommandNamesOf(localCommand)).not.toHaveLength(0);
    expect(subcommandNamesOf(localCommand).filter((name) => !usage.includes(name))).toStrictEqual(
      [],
    );
  });

  it("fails without starting Docker Compose", ({ commandRun }) => {
    expect(commandRun.rejection).toMatch(/restart/u);
  });
});
