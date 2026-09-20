import {
  checkCode,
  effectDiagnostics,
  lifecycle,
  reactCompiler,
  sliceBoundaries,
  startOptions,
  taskInput,
  testRun,
  withoutEnvFileLoader,
} from "@repo/vite-config";
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
      ...checkCode,
      ...testRun,
      ...sliceBoundaries,
      build: { command: "vp build", input: [...taskInput, "!dist"] },
      "check:start": {
        cache: false,
        command: "./src/app/check-start.ts",
        dependsOn: ["build"],
      },
      start: { cache: false, command: "./src/app/cli.ts", dependsOn: ["build"] },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check"],
        prepr: ["build"],
        premerge: ["test", "check:start"],
        prerelease: [],
      }),
    },
  },
});
