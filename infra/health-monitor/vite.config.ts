import { defineConfig } from "vite-plus";

import { taskInput } from "@repo/config/vite";

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
  run: { tasks: { build: { command: "vp pack", input: [...taskInput] } } },
});
