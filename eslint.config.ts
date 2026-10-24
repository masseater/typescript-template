import { defineConfig, globalIgnores, includeIgnoreFile } from "@eslint/config-helpers";
import tanstackStart from "@tanstack/eslint-plugin-start";
import parser from "@typescript-eslint/parser";

import { generated } from "./lint.config.ts";

export default defineConfig(
  includeIgnoreFile(`${import.meta.dirname}/.gitignore`),
  globalIgnores(generated),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser, parserOptions: { projectService: true } },
    extends: [tanstackStart.configs["flat/recommended"]],
    linterOptions: { reportUnusedDisableDirectives: "error", reportUnusedInlineConfigs: "error" },
  },
);
