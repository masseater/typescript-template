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
  {
    files: ["**/alchemy.*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.name="Stack"]:not([arguments.0.name="APP_NAME"]):not([arguments.0.type="TemplateLiteral"][arguments.0.quasis.0.value.raw=""][arguments.0.expressions.0.name="PREFIX"])',
          message:
            "スタック名には app-name.ts の APP_NAME か、PREFIX で始まるテンプレートリテラルを渡す",
        },
        {
          selector:
            'Program:not(:has(YieldExpression[delegate=true] > Identifier.argument[name="requireAppPrefix"]))',
          message:
            "スタックの最後で app-name.ts の requireAppPrefix を yield* して、リソース名の prefix を検査する",
        },
        {
          selector:
            'CallExpression[callee.name="Stack"] > .arguments:nth-child(3):not(:has(FunctionExpression > BlockStatement > ExpressionStatement:nth-last-child(2) > YieldExpression[delegate=true] > Identifier.argument[name="requireAppPrefix"]))',
          message:
            "スタックの最後で app-name.ts の requireAppPrefix を yield* して、リソース名の prefix を検査する",
        },
      ],
    },
  },
);
