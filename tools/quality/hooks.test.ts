import { lifecycles } from "@repo/config/vite";
import { describe, expect, it } from "vite-plus/test";

import {
  commands,
  configuredDirectories,
  dependencies,
  reachable,
  scriptNames,
  taskNames,
  workspaceDirectories,
} from "./tasks.ts";

const hooks: Readonly<Record<string, string>> = import.meta.glob("../../.vite-hooks/pre-*", {
  eager: true,
  import: "default",
});

const workflows: Readonly<Record<string, string>> = import.meta.glob(
  "../../.github/workflows/*.yml",
  { eager: true, import: "default" },
);

const pnpmWorkspaces: Readonly<Record<string, string>> = import.meta.glob(
  "../../pnpm-workspace.yaml",
  { eager: true, import: "default" },
);

const gatedTask = /^(?:build|check|verify)(?::|$)/u;
const runOnDemand = new Set([
  "infra/cloudflare: verify:account",
  "tools/observe: verify",
  ".: check:repository",
]);
const minuteLongCommands = ["vp run", "vp test", "vp build", "vp pack"];

const hookStages = Object.entries(hooks).map(
  ([file, source]) => [file.replace(/^.*\/pre-/u, "pre"), source] as const,
);

function misplacedHooks(): string[] {
  return hookStages
    .filter(
      ([stage, source]) =>
        !lifecycles.some((name) => name === stage) || source !== `vp run -r ${stage}\n`,
    )
    .map(([stage]) => stage);
}

function workflowRuns(file: string): string[] {
  const workflow = workflows[file];
  if (workflow === undefined) {
    throw new Error(`${file} is missing`);
  }
  const step = /^\s*(?:- )?run: /u;
  return (workflow.match(/^\s*(?:- )?run: .+$/gmu) ?? [])
    .map((line: string) => line.replace(step, ""))
    .filter((command: string) => command.startsWith("vp "));
}

function brokenChain(directory: string): string[] {
  return lifecycles.flatMap((name, index) => {
    const previous = lifecycles.slice(Math.max(index - 1, 0), index);
    const chained =
      taskNames(directory).includes(name) &&
      commands(directory, name).length === 0 &&
      previous.every((stage) => dependencies(directory, name).includes(stage));
    return chained ? [] : [`${directory}: ${name}`];
  });
}

function ungated(directory: string): string[] {
  const gate = new Set(reachable(directory, ["premerge"]));
  return [...taskNames(directory), ...scriptNames(directory)]
    .filter((name) => gatedTask.test(name) && !gate.has(name))
    .map((name) => `${directory}: ${name}`)
    .filter((entry) => !runOnDemand.has(entry));
}

function slowBeforePush(directory: string): string[] {
  return reachable(directory, ["prepush"])
    .filter(
      (name) =>
        name.includes("#") ||
        commands(directory, name).some((command) =>
          minuteLongCommands.some((slow) => command.startsWith(slow)),
        ),
    )
    .map((name) => `${directory}: ${name}`);
}

describe("lifecycle entry points", () => {
  it("each hook runs its lifecycle task in every workspace", () => {
    expect.hasAssertions();
    expect(hookStages.length).toBeGreaterThan(0);
    expect(misplacedHooks()).toStrictEqual([]);
  });

  it("the check workflow runs only the merge gate across every workspace", () => {
    expect.hasAssertions();
    expect([...new Set(workflowRuns("../../.github/workflows/check.yml"))]).toStrictEqual([
      "vp run -r premerge",
    ]);
  });

  it("every workspace declares its tasks where the lifecycle finds them", () => {
    expect.hasAssertions();
    expect(pnpmWorkspaces["../../pnpm-workspace.yaml"]).toMatch(
      /^packages:\n {2}- apps\/\*\n {2}- libs\/\*\n {2}- infra\/\*\n {2}- tools\/\*\n(?! {2}-)/u,
    );
    expect(configuredDirectories).toStrictEqual(workspaceDirectories);
  });
});

describe("lifecycle contents", () => {
  it("every workspace chains precommit into prepush into premerge", () => {
    expect.hasAssertions();
    expect(configuredDirectories.flatMap((directory) => brokenChain(directory))).toStrictEqual([]);
  });

  it("the merge gate runs every check, build and verification", () => {
    expect.hasAssertions();
    expect(configuredDirectories.flatMap((directory) => ungated(directory))).toStrictEqual([]);
  });

  it("checks staged secrets before a commit", () => {
    expect.hasAssertions();
    expect(
      configuredDirectories.filter((directory) =>
        reachable(directory, ["precommit"]).includes("check:staged"),
      ),
    ).toStrictEqual(["tools/quality"]);
  });

  it("leaves tests, builds and work in other workspaces to ci", () => {
    expect.hasAssertions();
    expect(configuredDirectories.flatMap((directory) => slowBeforePush(directory))).toStrictEqual(
      [],
    );
  });
});
