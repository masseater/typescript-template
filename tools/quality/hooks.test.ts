import { describe, expect, it } from "vite-plus/test";

import { field } from "./dependencies.ts";

const manifests: Readonly<Record<string, unknown>> = import.meta.glob("../../package.json", {
  eager: true,
  import: "default",
});

const workflows: Readonly<Record<string, string>> = import.meta.glob(
  "../../.github/workflows/*.yml",
  { eager: true, import: "default" },
);

function script(name: string): string {
  const command = field(field(manifests["../../package.json"], "scripts"), name);
  if (typeof command !== "string") {
    throw new TypeError(`Script ${name} must be a string`);
  }
  return command;
}

function workflowRuns(file: string): string[] {
  const workflow = workflows[file];
  if (workflow === undefined) {
    throw new Error(`${file} is missing`);
  }
  const step = /^\s*- run: /u;
  return (workflow.match(/^\s*- run: .+$/gmu) ?? []).map((line: string) => line.replace(step, ""));
}

describe("git hooks", () => {
  it("ci runs the pre-push verification scoped to the pull request's changes", () => {
    expect.hasAssertions();
    const prepush = script("prepush")
      .split(" && ")
      .map((command) => command.replace("--changed origin/main", "$TEST_SCOPE"));
    expect(workflowRuns("../../.github/workflows/check.yml")).toStrictEqual(prepush);
  });
});
