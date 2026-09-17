import { defineConfig } from "vite-plus";

export default defineConfig({
  root: import.meta.dirname,
  test: { include: ["src/pure.test.ts", "src/artifact-policy.test.ts"] },
});
