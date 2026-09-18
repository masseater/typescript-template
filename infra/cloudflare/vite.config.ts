import { applications } from "@repo/config";
import { effectDiagnostics, lifecycle, taskInput } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

import { monitorStacks } from "./src/monitors.ts";

const stackBuilds = [...applications, ...monitorStacks].map((unit) => `@repo/${unit}#build`);

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
        command: "node src/cli.ts plan all",
        dependsOn: stackBuilds,
      },
      "verify:stacks": {
        command: "node src/check-stacks.ts",
        dependsOn: stackBuilds,
        input: [...taskInput],
      },
      ...lifecycle({ precommit: [], premerge: ["verify:stacks"], prepush: ["check:effect"] }),
    },
  },
});
