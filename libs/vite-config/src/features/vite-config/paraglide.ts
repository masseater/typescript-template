import { paraglideVitePlugin } from "@inlang/paraglide-js";

import { paraglideCompileOptions, paraglideStrategy } from "./paraglide-options.ts";
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

const paraglideSources = [
  "libs/vite-config/src/features/vite-config/paraglide-options.ts",
  "libs/vite-config/src/features/vite-config/compile-paraglide.ts",
] as const;

const workspaceParaglideCompile = {
  command: "./libs/vite-config/src/features/vite-config/compile-workspace-paraglide.ts",
  input: [
    ...taskInput,
    { base: "workspace", pattern: "apps/*/messages/**" },
    { base: "workspace", pattern: "apps/*/project.inlang/settings.json" },
    ...withoutInlangState.map((pattern) => ({
      base: "workspace" as const,
      pattern: pattern.replace("!", "!apps/*/"),
    })),
    ...[
      ...paraglideSources,
      "libs/vite-config/src/features/vite-config/compile-workspace-paraglide.ts",
    ].map((pattern) => ({ base: "workspace" as const, pattern })),
  ],
  output: [{ base: "workspace", pattern: "apps/*/.paraglide/**" }],
} satisfies NonNullable<NonNullable<NonNullable<UserConfig["run"]>["tasks"]>[string]>;

const paraglideCompileInputs = [
  ...taskInput,
  "messages/**",
  "project.inlang/settings.json",
  ...withoutInlangState,
  ...paraglideSources.map((pattern) => ({ base: "workspace" as const, pattern })),
];

export {
  paraglideAppPlugin,
  paraglideCompileInputs,
  paraglideCompileOptions,
  paraglideStrategy,
  withoutInlangState,
  workspaceParaglideCompile,
};
