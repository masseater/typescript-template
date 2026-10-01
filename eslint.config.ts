import tanstackStart from "@tanstack/eslint-plugin-start";
import parser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";

import { generated } from "./lint.config.ts";

export default defineConfig(globalIgnores(generated), {
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser, parserOptions: { projectService: true } },
  extends: [tanstackStart.configs["flat/recommended"]],
  linterOptions: { reportUnusedDisableDirectives: "error", reportUnusedInlineConfigs: "error" },
});
