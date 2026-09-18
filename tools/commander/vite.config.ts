import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite-plus";

import {
  effectDiagnostics,
  lifecycle,
  reactCompiler,
  startOptions,
  taskInput,
  withoutEnvFileLoader,
} from "@repo/config/vite";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [
    tailwindcss(),
    ...withoutEnvFileLoader(tanstackStart({ ...startOptions, server: { entry: "app/server.ts" } })),
    reactCompiler(),
  ],
  run: {
    tasks: {
      ...effectDiagnostics,
      build: { command: "vp build", input: [...taskInput, "!dist"] },
      "check:start": {
        cache: false,
        command: "node src/app/check-start.ts",
        dependsOn: ["build"],
      },
      start: { cache: false, command: "node src/app/cli.ts", dependsOn: ["build"] },
      ...lifecycle({
        precommit: [],
        premerge: ["build", "check:start"],
        prepush: ["check:effect", "check"],
      }),
    },
  },
});
