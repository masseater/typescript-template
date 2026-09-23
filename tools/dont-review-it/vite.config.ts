import { fileURLToPath } from "node:url";

import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import { effectDiagnostics, intentValidation, lifecycle, testRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...intentValidation,
      ...testRun,
      "check:staged": { cache: false, command: "./src/repository/check-staged.ts" },
      "pr-affected": { cache: false, command: "./src/repository/pr-affected.ts" },
      "claude-later": { cache: false, command: "./src/repository/claude-later.ts" },
      "clean:shared-task-cache": {
        cache: false,
        command: "./src/repository/clean-shared-task-cache.ts",
      },
      ...lifecycle({
        precommit: ["check:staged"],
        prepush: ["check:effect", "check"],
        prepr: ["test"],
      }),
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk")),
      },
    },
    testTimeout: 60_000,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      exclude: ["specs/**", "src/repository/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    exclude: ["**/node_modules/**", "**/dist/**", "src/repository/**"],
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: ["src/cli.ts", "src/canonical-literal-types/run-as-task.ts", "src/index.ts"],
    external: [/^vite-plus/],
    dts: { generator: "tsgo" },
  },
});
