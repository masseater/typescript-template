import { spawnSync } from "node:child_process";

import { EXIT_FAILURE, field, run } from "../shared/runner.ts";

const SUCCESS = 0;

const passes = (args: readonly string[]): boolean =>
  spawnSync("vp", ["run", "--log", "grouped", ...args], { stdio: "inherit" }).status === SUCCESS;

const selectorOf = (id: string): readonly string[] => {
  const parts = id.split("#");
  const task = parts.pop() ?? id;
  const pkg = parts.join("#");
  if (pkg === "") {
    return ["-w", task];
  }
  return ["--filter", `{./${pkg}}`, task];
};

const dependenciesOfVerify = (): readonly string[] => {
  const plan = field(JSON.parse(run("vp", ["run", "--dry-run", "--json", "verify"])), "plan");
  const dependsOn = field(field(plan, "verify"), "dependsOn");
  if (!Array.isArray(dependsOn)) {
    return [];
  }
  return dependsOn.filter((id): id is string => typeof id === "string");
};

if (!passes(["verify"])) {
  const failed = dependenciesOfVerify().filter((id) => !passes(selectorOf(id)));
  console.error(
    `verify failed. Tasks that still fail when each runs on its own: ${failed.join(", ")}`,
  );
  process.exitCode = EXIT_FAILURE;
}
