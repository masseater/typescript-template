import { effectDiagnostics, lifecycle, taskInput } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  pack: {
    deps: {
      alwaysBundle: ["effect", "@repo/monitor"],
      onlyBundle: ["effect", "@repo/monitor"],
    },
    entry: { index: "src/worker.ts" },
    format: "esm",
    outExtensions: () => ({ js: ".js" }),
    platform: "browser",
    target: "es2023",
  },
  run: {
    tasks: {
      ...effectDiagnostics,
      build: { command: "vp pack", input: [...taskInput] },
      ...lifecycle({
        precommit: [],
        prepush: ["check:effect"],
        prepr: [],
        premerge: ["build"],
        prerelease: [],
      }),
    },
  },
});
