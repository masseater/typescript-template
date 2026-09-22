import { defineConfig } from "vite-plus";

import { testableLibraryRun } from "./src/vite.ts";

export default defineConfig({
  run: testableLibraryRun,
  test: {
    mockReset: true,
    restoreMocks: true,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    testTimeout: 30_000,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
