import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { storybookPort } from "@template/config";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

const storybook = await storybookTest({
  configDir: import.meta.dirname,
  storybookScript: "vp run --filter @template/dev storybook",
  storybookUrl: `http://localhost:${String(storybookPort)}`,
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
    fileParallelism: false,
    name: "storybook",
  },
});
