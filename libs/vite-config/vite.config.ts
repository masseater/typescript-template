import { fileURLToPath } from "node:url";

import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { defineConfig } from "vite-plus";

import { awaitingEffectRun } from "./src/features/vite-config/vite.ts";

export default defineConfig({
  run: awaitingEffectRun,
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
