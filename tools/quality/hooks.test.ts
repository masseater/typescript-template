import { describe, expect, it } from "vite-plus/test";

import type { UserConfig } from "vite-plus";

const configs: Readonly<Record<string, Readonly<UserConfig>>> = import.meta.glob(
  "../../vite.config.ts",
  { eager: true, import: "default" },
);

const hooks: Readonly<Record<string, string>> = import.meta.glob("../../.vite-hooks/pre-*", {
  eager: true,
  import: "default",
});

const workflows: Readonly<Record<string, string>> = import.meta.glob(
  "../../.github/workflows/*.yml",
  { eager: true, import: "default" },
);

const tasks = configs["../../vite.config.ts"]?.run?.tasks ?? {};

function taskCommands(name: string): string[] {
  const task = tasks[name];
  if (task === undefined) {
    throw new Error(`Task ${name} is missing`);
  }
  return [typeof task === "object" && "command" in task ? task.command : task].flat();
}

function hook(name: string): string {
  const source = hooks[`../../.vite-hooks/${name}`];
  if (source === undefined) {
    throw new Error(`.vite-hooks/${name} is missing`);
  }
  return source.trim();
}

function workflowRuns(file: string): string[] {
  const workflow = workflows[file];
  if (workflow === undefined) {
    throw new Error(`${file} is missing`);
  }
  const step = /^\s*(?:- )?run: /u;
  return (workflow.match(/^\s*(?:- )?run: .+$/gmu) ?? []).map((line: string) =>
    line.replace(step, ""),
  );
}

const checksOnlyCiRuns = ["vp run check:dev"];

describe("git hooks", () => {
  it("checks formatting, linting, types and staged secrets before a commit", () => {
    expect.hasAssertions();
    expect(hook("pre-commit")).toBe("vp run precommit");
    expect(taskCommands("precommit")).toStrictEqual(["vp check", "vp run check:staged"]);
  });

  it("runs the checks the commit hook leaves out before a push", () => {
    expect.hasAssertions();
    expect(hook("pre-push")).toBe("vp run prepush");
    expect(taskCommands("check")).toStrictEqual([
      "vp run precommit",
      "vp run prepush",
      ...checksOnlyCiRuns,
    ]);
  });

  it("leaves the checks that take minutes to ci", () => {
    expect.hasAssertions();
    const hooked = [...taskCommands("precommit"), ...taskCommands("prepush")];
    const reserved = [...checksOnlyCiRuns, "vp test", "vp run build"];
    expect(
      hooked.filter((command) => reserved.some((entry) => command.startsWith(entry))),
    ).toStrictEqual([]);
  });

  it("ci runs the whole check, the test suite and the whole build", () => {
    expect.hasAssertions();
    expect(workflowRuns("../../.github/workflows/check.yml")).toStrictEqual([
      "vp run check",
      "vp test run $TEST_SCOPE",
      "vp run build",
    ]);
  });
});
