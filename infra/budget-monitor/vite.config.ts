import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/worker.ts" },
    format: "esm",
    platform: "browser",
    target: "es2023",
    outExtensions: () => ({ js: ".js" }),
    deps: { alwaysBundle: ["valibot"], onlyBundle: ["valibot"], neverBundle: [/^cloudflare:/] },
  },
});
