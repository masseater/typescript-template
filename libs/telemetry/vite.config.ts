import { vitestOpenTelemetry } from "@repo/telemetry/vitest-sdk-path";
import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: effectRun(import.meta.dirname),
  test: {
    experimental: { openTelemetry: vitestOpenTelemetry },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
