import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { telemetryAsked } from "./src/features/telemetry/optional-setting.ts";
import { vitestSdkPath } from "./src/features/telemetry/vitest-sdk-path.ts";

export default defineConfig({
  run: effectRun(import.meta.dirname),
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: vitestSdkPath,
      },
    },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
