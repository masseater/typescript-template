import { paraglideVitePlugin } from "@inlang/paraglide-js";

import { localizedApps, paraglideCompileOptions, paraglideStrategy } from "./paraglide-options.ts";
import { taskInput } from "./task-input.ts";

import type { PluginOption, UserConfig } from "vite-plus";

const paraglideAppPlugin = (): PluginOption => paraglideVitePlugin(paraglideCompileOptions());

const withoutInlangState = [
  "!project.inlang/.gitignore",
  "!project.inlang/.meta.json",
  "!project.inlang/README.md",
  "!project.inlang/cache",
  "!project.inlang/cache/**",
  "!project.inlang/.lix",
  "!project.inlang/.lix/**",
] as const;

const workspaceParaglideCompile = {
  command: "./libs/vite-config/src/features/vite-config/compile-workspace-paraglide.ts",
  input: [
    ...taskInput,
    ...localizedApps.flatMap((app) =>
      [
        `apps/${app}/messages/**`,
        `apps/${app}/project.inlang/settings.json`,
        `!apps/${app}`,
        `!apps/${app}/project.inlang`,
        `!apps/${app}/.paraglide/**`,
        ...withoutInlangState.map((pattern) => pattern.replace("!", `!apps/${app}/`)),
      ].map((pattern) => ({ base: "workspace" as const, pattern })),
    ),
    {
      base: "workspace",
      pattern: "libs/vite-config/src/features/vite-config/paraglide-options.ts",
    },
    {
      base: "workspace",
      pattern: "libs/vite-config/src/features/vite-config/compile-workspace-paraglide.ts",
    },
  ],
  output: localizedApps.map((app) => ({
    base: "workspace" as const,
    pattern: `apps/${app}/.paraglide/**`,
  })),
} satisfies NonNullable<NonNullable<NonNullable<UserConfig["run"]>["tasks"]>[string]>;

export {
  paraglideAppPlugin,
  paraglideCompileOptions,
  paraglideStrategy,
  withoutInlangState,
  workspaceParaglideCompile,
};
