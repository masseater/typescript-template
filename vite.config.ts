import baselineJs from "eslint-plugin-baseline-js";
import { defineConfig } from "vite-plus";

import {
  baselineJsRules,
  decisionPluginName,
  decisionRules,
  effectRules,
  eslintReactRules,
  generated,
  htmlReactRules,
  reactHooksRules,
  restrictedImports,
  shadcnRules,
  tanstackQueryRules,
  tanstackRouterRules,
  turnedOff,
} from "./lint.config.ts";

export default defineConfig({
  staged: {
    "!(*.md)": "vp check --fix",
    "*.md": ["markdownlint-cli2 --fix", "vp check --fix"],
  },
  fmt: {
    ignorePatterns: generated,
    sortImports: true,
    sortTailwindcss: true,
    sortPackageJson: true,
  },
  lint: {
    ignorePatterns: generated,
    plugins: [
      "eslint",
      "typescript",
      "unicorn",
      "oxc",
      "import",
      "react",
      "react-perf",
      "jsx-a11y",
      "jsdoc",
      "promise",
      "node",
      "effecttsgo",
    ],
    categories: {
      correctness: "error",
      suspicious: "error",
      pedantic: "error",
      perf: "error",
      style: "error",
      restriction: "error",
      nursery: "error",
    },
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "tanstack-query", specifier: "@tanstack/eslint-plugin-query" },
      { name: "tanstack-router", specifier: "@tanstack/eslint-plugin-router" },
      { name: "drizzle", specifier: "eslint-plugin-drizzle" },
      { name: "react-hooks-js", specifier: "eslint-plugin-react-hooks" },
      { name: "@eslint-react", specifier: "@eslint-react/eslint-plugin" },
      { name: "shadcn", specifier: "@shadcn/lint" },
      { name: "no-comments", specifier: "eslint-plugin-no-comments" },
      { name: "baseline-js", specifier: "eslint-plugin-baseline-js" },
      { name: "@html-eslint/react", specifier: "@html-eslint/eslint-plugin-react" },
      { name: decisionPluginName, specifier: "./decision-rules.ts" },
      { name: "eslint-js", specifier: "oxlint-plugin-eslint" },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "no-comments/disallowComments": ["error", { allow: ["oxlint-disable", "eslint-disable"] }],
      ...tanstackQueryRules,
      ...tanstackRouterRules,
      "drizzle/enforce-delete-with-where": "error",
      "drizzle/enforce-update-with-where": "error",
      ...shadcnRules,
      ...baselineJsRules,
      ...baselineJs.configs.recommended().rules,
      ...htmlReactRules,
      ...reactHooksRules,
      ...eslintReactRules,
      ...effectRules,
      "eslint/sort-imports": "off",
      "eslint/sort-keys": "off",
      "import/no-named-export": "off",
      "import/prefer-default-export": "off",
      "react/react-in-jsx-scope": "off",
      "eslint/no-undef": "off",
      "typescript/promise-function-async": "off",
      "react/forbid-component-props": "off",
      "oxc/no-rest-spread-properties": "off",
      "node/no-top-level-await": "off",
      "eslint/one-var": ["error", "never"],
      "eslint/no-restricted-imports": ["error", restrictedImports],
      "typescript/prefer-readonly-parameter-types": [
        "error",
        {
          ignoreInferredTypes: true,
          allow: [
            { from: "lib", name: "Request" },
            {
              from: "package",
              package: "@cloudflare/workers-types",
              name: "AnalyticsEngineDataset",
            },
            { from: "package", package: "@tanstack/query-core", name: "QueryClient" },
            {
              from: "package",
              package: "react",
              name: ["ReactNode", "ButtonHTMLAttributes", "ClassAttributes"],
            },
            { from: "package", package: "clsx", name: "ClassValue" },
            { from: "package", package: "lighthouse", name: ["FlowResult", "Step"] },
            { from: "package", package: "puppeteer-core", name: ["Browser", "Page"] },
            {
              from: "package",
              package: "effect",
              name: ["Cause", "Context", "Effect", "Exit", "Layer", "Option"],
            },
          ],
        },
      ],
      "eslint/no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
      "react/function-component-definition": [
        "error",
        { namedComponents: "arrow-function", unnamedComponents: "arrow-function" },
      ],
      "eslint/new-cap": [
        "error",
        {
          capIsNewExceptions: ["App", "CloudflareApiLive", "Secret", "Stack"],
          capIsNewExceptionPattern: String.raw`^(Config|Context|Data|Schema|AnalyticsEngine|ApiToken|D1|Logpush|R2|Ruleset|Rules|Website|Workers|Zone)\.`,
        },
      ],
      "typescript/no-empty-interface": ["error", { allowSingleExtends: true }],
      "typescript/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
      "react/jsx-filename-extension": ["error", { extensions: [".tsx"] }],
      "react/only-export-components": ["error", { allowExportNames: ["Route"] }],
    },
    overrides: [
      {
        files: ["**/*.config.ts", "**/alchemy.run.ts", "**/*.worker.ts", "decision-rules.ts"],
        rules: { "import/no-default-export": "off" },
      },
      {
        files: ["**/alchemy.*.ts"],
        rules: {
          "eslint-js/no-restricted-syntax": [
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
      {
        files: ["**/shared/ui/**"],
        rules: { "shadcn/no-restyle": "off", "react/jsx-props-no-spreading": "off" },
      },
      {
        files: ["apps/web/src/**/*.{ts,tsx}"],
        rules: decisionRules,
      },
      {
        files: ["**/*.test.ts"],
        rules: turnedOff(decisionRules),
      },
    ],
    settings: {
      [decisionPluginName]: { model: "openrouter/typesafe/jev-1.14" },
    },
    options: {
      typeAware: true,
      typeCheck: true,
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
    },
  },
  run: {
    cache: true,
    tasks: {
      "actions-lint": {
        command:
          'uvx --from actionlint-py@1.7.12.25 actionlint && uvx zizmor@1.30.1 $(test -n "$CLAUDE_CODE_REMOTE" && echo --no-online-audits) .github && ast-grep scan --rule .github/rules/no-full-history-checkout.yml .github/workflows',
        cache: {
          env: ["CLAUDE_CODE_REMOTE"],
          untrackedEnv: [
            "GH_TOKEN",
            "HTTPS_PROXY",
            "https_proxy",
            "NO_PROXY",
            "no_proxy",
            "SSL_CERT_FILE",
          ],
        },
      },
      verify: {
        command: "vp check",
        cache: {
          env: ["OPENROUTER_API_KEY"],
          untrackedEnv: [
            "CLAUDECODE",
            "CLAUDE_CODE_REMOTE",
            "HTTPS_PROXY",
            "https_proxy",
            "NO_PROXY",
            "no_proxy",
            "SSL_CERT_FILE",
            "NODE_EXTRA_CA_CERTS",
          ],
        },
        dependsOn: [
          "test-all",
          "eslint",
          "syncpack",
          "markdown-lint",
          "renovate",
          "actions-lint",
          "steiger-all",
          "db-check-all",
          "fallow-all",
          "audit",
        ],
      },
      "test-all": "vp run -r test",
      eslint: "NODE_OPTIONS=--max-old-space-size=4096 eslint --max-warnings 0 .",
      syncpack: "syncpack lint",
      "steiger-all": "vp run -r steiger",
      "db-check-all": "vp run -r db:check",
      "fallow-all": "vp run -r fallow",
      audit: {
        command: "vp pm audit",
        cache: false,
      },
      gitleaks: {
        command:
          'go run github.com/zricethezav/gitleaks/v8@v8.30.1 git --redact --no-banner --log-opts="$(git rev-parse -q --verify "$GITLEAKS_BASE" || echo origin/main)..HEAD"',
        cache: false,
      },
    },
  },
});
