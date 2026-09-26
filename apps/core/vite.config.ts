import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
import { effectRun, taskInput, telemetryEnv } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: {
      alwaysBundle: [/^@repo\//, /^effect(?:\/|$)/],
      onlyBundle: ["@better-auth/core", "better-call", "drizzle-orm", "effect", "msgpackr"],
    },
    entry: { index: "src/features/core/worker.ts" },
    format: "esm" as const,
    outExtensions: () => ({ js: ".js" }),
    platform: "browser" as const,
    target: "es2023",
  },
  run: {
    tasks: {
      ...effectRun(import.meta.dirname, { prepr: ["build"] }).tasks,
      build: {
        command: "vp pack",
        dependsOn: ["check:effect"],
        input: [...taskInput],
        env: [...telemetryEnv],
      },
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
