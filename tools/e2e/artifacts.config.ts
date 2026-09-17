import { defineConfig } from "vite-plus";

export default defineConfig({
  root: import.meta.dirname,
  test: { include: ["src/artifacts.test.ts"], retry: 0 },
});
