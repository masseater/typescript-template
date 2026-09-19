import { storybookOrigin } from "@repo/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

const storybook = await storybookTest({
  configDir: import.meta.dirname,
  storybookScript: "vp run --filter @repo/dev storybook",
  storybookUrl: storybookOrigin,
});

export default defineConfig({
  plugins: storybook,
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
    },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    fileParallelism: false,
    mockReset: true,
    name: "storybook",
    restoreMocks: true,
  },
});
