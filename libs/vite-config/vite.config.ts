import { vitestOpenTelemetry } from "@repo/telemetry/vitest-sdk-path";
import { defineConfig } from "vite-plus";

import { awaitingEffectRun } from "./src/features/vite-config/vite.ts";

export default defineConfig({
  run: awaitingEffectRun(import.meta.dirname),
  test: {
    experimental: { openTelemetry: vitestOpenTelemetry },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
