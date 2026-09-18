import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: {
      alwaysBundle: ["effect", "@template/monitor"],
      onlyBundle: ["effect", "@template/monitor"],
    },
    entry: { index: "src/worker.ts" },
    format: "esm",
    outExtensions: () => ({ js: ".js" }),
    platform: "browser",
    target: "es2023",
  },
  run: { tasks: { build: "vp pack" } },
});
