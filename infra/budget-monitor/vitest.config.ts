import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
