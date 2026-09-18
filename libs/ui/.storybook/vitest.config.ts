import { browserTelemetry } from "@template/perf/vitest";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import { storybookPort } from "@template/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const storybook = await storybookTest({
  configDir: import.meta.dirname,
  storybookScript: "vp run --filter @template/dev storybook",
  storybookUrl: `http://localhost:${String(storybookPort)}`,
});
const telemetry = browserTelemetry();

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: storybook,
  server: { proxy: telemetry.proxy },
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
    },
    experimental: { openTelemetry: telemetry.openTelemetry },
    fileParallelism: false,
    name: "storybook",
  },
});
