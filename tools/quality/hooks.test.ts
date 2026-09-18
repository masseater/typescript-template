import { describe, expect, it } from "vite-plus/test";
import type { UserConfig } from "vite-plus";
import { field } from "./dependencies.ts";

const manifests: Readonly<Record<string, unknown>> = import.meta.glob("../../package.json", {
  eager: true,
  import: "default",
});

const rootConfig: Readonly<Record<string, Readonly<UserConfig>>> = import.meta.glob(
  "../../vite.config.ts",
  { eager: true, import: "default" },
);

const workflows: Readonly<Record<string, string>> = import.meta.glob(
  "../../.github/workflows/*.yml",
  { eager: true, import: "default" },
);

const mergify: Readonly<Record<string, string>> = import.meta.glob("../../.mergify.yml", {
  eager: true,
  import: "default",
});

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
  it("git hooks run the verified package scripts", () => {
    expect.hasAssertions();
    expect(
      import.meta.glob("../../.vite-hooks/pre-*", { eager: true, import: "default" }),
    ).toStrictEqual({
      "../../.vite-hooks/pre-commit": "vp run precommit\n",
      "../../.vite-hooks/pre-push": "vp run prepush\n",
    });
    expect(script("precommit")).toBe("vp run check");
    expect(rootConfig["../../vite.config.ts"]?.run?.tasks?.["check"]).toHaveProperty(
      ["command", 0],
      "vp check",
    );
    expect(script("prepush")).toContain("vp test run --changed origin/main");
  });

  it("ci runs the pre-push verification scoped to the pull request's changes", () => {
    expect.hasAssertions();
    const prepush = script("prepush")
      .split(" && ")
      .map((command) => command.replace("--changed origin/main", "$TEST_SCOPE"));
    expect(workflowRuns("../../.github/workflows/check.yml")).toStrictEqual(prepush);
  });

  it("the merge queue runs every test before merging", () => {
    expect.hasAssertions();
    const queueBranch = "startsWith(github.head_ref, 'mergify/merge-queue/')";
    expect(workflows["../../.github/workflows/check.yml"]).toContain(
      `name: \${{ ${queueBranch} && 'merge-queue' || 'check' }}`,
    );
    expect(workflows["../../.github/workflows/check.yml"]).toContain(
      `TEST_SCOPE: \${{ !${queueBranch} && '--changed HEAD^1' || '' }}`,
    );
    expect(mergify["../../.mergify.yml"]).toContain(
      "merge_conditions:\n      - check-success = merge-queue\n",
    );
  });
});
