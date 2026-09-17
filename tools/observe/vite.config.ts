import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  root: import.meta.dirname,
  test: { include: ["src/**/*.test.ts"] },
});
