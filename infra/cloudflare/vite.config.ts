import { defineConfig } from "vite-plus";

import { applications } from "@repo/config";
import { effectDiagnostics, lifecycle, taskInput } from "@repo/config/vite";

import { monitorStacks } from "./src/monitors.ts";

function builds(units: readonly string[]): string[] {
  return units.map((unit) => `@repo/${unit}#build`);
}

const stackBuilds = builds([...applications, ...monitorStacks]);

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      deploy: {
        cache: false,
        command: "node src/cli.ts deploy",
        dependsOn: stackBuilds,
      },
      preview: {
        cache: false,
        command: "node src/cli.ts plan",
        dependsOn: stackBuilds,
      },
      "verify:artifacts": {
        command: "node src/check-artifacts.ts",
        dependsOn: builds(applications),
        input: [...taskInput],
      },
      "verify:stacks": {
        command: "node src/check-stacks.ts",
        dependsOn: stackBuilds,
        input: [...taskInput],
      },
      ...lifecycle({
        precommit: [],
        premerge: ["verify:artifacts", "verify:stacks"],
        prepush: ["check:effect"],
      }),
    },
  },
});
