import { describe, expect, it } from "vite-plus/test";

import { field } from "./dependencies.ts";

import type { UserConfig } from "vite-plus";

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

const script = (name: string): string => {
  const command = field(field(manifests["../../package.json"], "scripts"), name);
  if (typeof command !== "string") {
    throw new TypeError(`Script ${name} must be a string`);
  }
  return command;
};

const workflowRuns = (file: string): string[] => {
  const workflow = workflows[file];
  if (workflow === undefined) {
    throw new Error(`${file} is missing`);
  }
  const step = /^\s*- run: /u;
  return (workflow.match(/^\s*- run: .+$/gmu) ?? []).map((line: string) => line.replace(step, ""));
};

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
    expect(rootConfig["../../vite.config.ts"]?.run?.tasks?.check).toHaveProperty(
      ["command", 0],
      "vp check",
    );
    expect(script("prepush")).toContain("vp test run --changed origin/main");
  });

  it("ci runs the pre-push verification against every test", () => {
    expect.hasAssertions();
    const prepush = script("prepush")
      .split(" && ")
      .map((command) => command.replace(" --changed origin/main", ""));
    expect(workflowRuns("../../.github/workflows/check.yml")).toStrictEqual(prepush);
  });
});
