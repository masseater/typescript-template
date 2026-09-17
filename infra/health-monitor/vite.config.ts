import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  pack: {
    deps: { alwaysBundle: ["valibot"], neverBundle: [/^cloudflare:/u], onlyBundle: ["valibot"] },
    entry: { index: "src/worker.ts" },
    format: "esm",
    outExtensions: () => ({ js: ".js" }),
    platform: "browser",
    target: "es2023",
  },
});
