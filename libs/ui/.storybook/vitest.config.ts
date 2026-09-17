import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

const storybook = await storybookTest({
  configDir: import.meta.dirname,
  storybookScript: "vp run --filter @template/ui storybook",
  storybookUrl: "http://localhost:3051",
});

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  optimizeDeps: { entries: ["src/**/*.stories.tsx"] },
  plugins: storybook,
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
    },
    name: "storybook",
  },
});
