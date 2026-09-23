import { fileURLToPath } from "node:url";

import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { repositoryRoot } from "@repo/config/repository-root";

import { paths } from "./host.ts";
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

const repositoryPath = (href: string): string =>
  paths.relative(repositoryRoot, fileURLToPath(href)).replaceAll("\\", "/");

const compileWorkspaceScript = repositoryPath(
  new URL("./compile-workspace-paraglide.ts", import.meta.url).href,
);

const workspaceParaglideCompile = {
  command: `./${compileWorkspaceScript}`,
  input: [
    ...taskInput,
    { base: "workspace", pattern: "apps/*/messages/**" },
    { base: "workspace", pattern: "apps/*/project.inlang/settings.json" },
    ...withoutInlangState.map((pattern) => ({
      base: "workspace" as const,
      pattern: pattern.replace("!", "!apps/*/"),
    })),
    {
      base: "workspace",
      pattern: repositoryPath(new URL("./paraglide-options.ts", import.meta.url).href),
    },
    { base: "workspace", pattern: compileWorkspaceScript },
  ],
  output: [{ base: "workspace", pattern: "apps/*/.paraglide/**" }],
} satisfies NonNullable<NonNullable<NonNullable<UserConfig["run"]>["tasks"]>[string]>;

export {
  paraglideAppPlugin,
  paraglideCompileOptions,
  paraglideStrategy,
  withoutInlangState,
  workspaceParaglideCompile,
};
