import { defineConfig } from "vite-plus";

export default defineConfig({
  root: import.meta.dirname,
  test: { include: ["src/**/*.test.ts"] },
});
