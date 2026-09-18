import { defineConfig } from "vite-plus";

import { applications } from "@repo/config";
import { effectDiagnostics, lifecycle, taskInput } from "@repo/config/vite";

import { monitorStacks } from "./src/monitors.ts";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "verify:stacks": {
        command: "node src/check-stacks.ts",
        dependsOn: [...applications, ...monitorStacks].map((unit) => `@repo/${unit}#build`),
        input: [...taskInput],
      },
      ...lifecycle({ precommit: [], premerge: ["verify:stacks"], prepush: ["check:effect"] }),
    },
  },
});
