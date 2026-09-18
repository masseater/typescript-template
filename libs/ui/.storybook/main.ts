import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import type { InlineConfig } from "vite-plus";

import { reactCompiler } from "@repo/config/vite";

function withAppTransforms(config: InlineConfig): InlineConfig {
  return { ...config, plugins: [...(config.plugins ?? []), tailwindcss(), reactCompiler()] };
}

const config: StorybookConfig = {
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest", "@storybook/addon-mcp"],
  core: { disableTelemetry: true },
  features: { componentsManifest: true },
  framework: "@storybook/react-vite",
  staticDirs: ["./public"],
  stories: ["../src/**/*.stories.tsx"],
  viteFinal: withAppTransforms,
};

// oxlint-disable-next-line import/no-default-export
export default config;
