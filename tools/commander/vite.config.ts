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
      start: { cache: false, command: "node src/app/cli.ts", dependsOn: ["build"] },
      ...lifecycle({ precommit: [], premerge: ["build"], prepush: ["check:effect", "check"] }),
    },
  },
});
