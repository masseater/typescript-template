import {
  effectDiagnostics,
  lifecycle,
  reactCompiler,
  sliceBoundaries,
  startOptions,
  taskInput,
  withoutEnvFileLoader,
} from "@repo/config/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    tailwindcss(),
    ...withoutEnvFileLoader(tanstackStart({ ...startOptions, server: { entry: "app/server.ts" } })),
    reactCompiler(),
  ],
  run: {
    tasks: {
      ...effectDiagnostics,
      ...sliceBoundaries,
      build: { command: "vp build", input: [...taskInput, "!dist"] },
      "check:start": {
        cache: false,
        command: "node src/app/check-start.ts",
        dependsOn: ["build"],
      },
      start: { cache: false, command: "node src/app/cli.ts", dependsOn: ["build"] },
      ...lifecycle({
        precommit: [],
        prepush: ["check:effect", "check"],
        prepr: ["build"],
        premerge: ["check:start"],
        prerelease: [],
      }),
    },
  },
});
