import type { InlineConfig } from "vite-plus";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function withTailwind(config: InlineConfig): InlineConfig {
  return { ...config, plugins: [...(config.plugins ?? []), tailwindcss()] };
}

const config: StorybookConfig = {
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest", "@storybook/addon-mcp"],
  core: { disableTelemetry: true },
  features: { componentsManifest: true },
  framework: "@storybook/react-vite",
  staticDirs: ["./public"],
  stories: ["../src/**/*.stories.tsx"],
  viteFinal: withTailwind,
};

// oxlint-disable-next-line import/no-default-export
export default config;
