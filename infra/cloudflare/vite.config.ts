import { defineConfig } from "vite-plus";

import { applications } from "@repo/config";
import { effectDiagnostics, lifecycle, taskInput } from "@repo/config/vite";

import { monitorStacks } from "./src/monitors.ts";

function builds(units: readonly string[]): string[] {
  return units.map((unit) => `@repo/${unit}#build`);
}

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "verify:artifacts": {
        command: "node src/check-artifacts.ts",
        dependsOn: builds(applications),
        input: [...taskInput],
      },
      "verify:stacks": {
        command: "node src/check-stacks.ts",
        dependsOn: builds([...applications, ...monitorStacks]),
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
