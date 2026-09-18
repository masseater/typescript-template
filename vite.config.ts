import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

import { applications } from "@template/config";
import { taskInput } from "@template/config/vite";

import { workerTests } from "./tools/quality/test-runtime.ts";

const textModulePattern = /\.ya?ml$|\/\.vite-hooks\/[^/]+$/u;

const ignoredPaths = [
  "**/mockServiceWorker.js",
  "**/routeTree.gen.ts",
  "**/dist/**",
  ".local/**",
  ".local-agents/**",
  "**/.wrangler/**",
];

const linkComponents = [
  "ButtonLink",
  "CardLink",
  "DropdownMenuLinkItem",
  "Link",
  "NavigationLink",
  "PaginationLink",
  "TextLink",
];

function textModule(code: string, id: string): string | undefined {
  return textModulePattern.test(id) ? `export default ${JSON.stringify(code)};` : undefined;
}

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  fmt: {
    ignorePatterns: ignoredPaths,
    sortImports: { internalPattern: ["@template/"], newlinesBetween: true },
    sortPackageJson: { sortScripts: true },
    sortTailwindcss: { functions: ["cn", "cva"], stylesheet: "./libs/ui/src/styles.css" },
  },
  lint: {
    categories: {
      correctness: "error",
      nursery: "error",
      pedantic: "error",
      perf: "error",
      restriction: "error",
      style: "error",
      suspicious: "error",
    },
    ignorePatterns: [...ignoredPaths, "**/node_modules/**"],
    jsPlugins: [
      "./tools/quality/rules.ts",
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      "@shadcn/lint",
    ],
    options: {
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
      respectEslintDisableDirectives: false,
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["apps/*/src/**/api.ts", "apps/*/src/**/*-api.ts", "libs/runtime/src/account.ts"],
        rules: {
          "typescript/explicit-function-return-type": "off",
          "typescript/explicit-module-boundary-types": "off",
        },
      },
      {
        files: ["libs/ui/src/shared/ui/**"],
        rules: {
          "react/forbid-component-props": ["error", { forbid: ["style"] }],
          "shadcn/no-restyle": "off",
        },
      },
      {
        files: ["infra/cloudflare/src/**"],
        rules: {
          "eslint/new-cap": [
            "error",
            {
              capIsNewExceptionPattern:
                "^(?:Schema|Context|Data|Config|ApiToken|D1|Email|Workers)\\.",
              capIsNewExceptions: ["DurableObject", "Stack", "Worker"],
            },
          ],
        },
      },
      {
        files: ["**/*.test.ts", "**/*-fixture.ts"],
        plugins: ["vitest"],
        rules: {
          "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
          "vitest/no-importing-vitest-globals": "off",
          "vitest/no-standalone-expect": [
            "error",
            { additionalTestBlockFunctions: ["it", "it.for", "test", "test.for"] },
          ],
          "vitest/prefer-to-be-falsy": "off",
          "vitest/prefer-to-be-truthy": "off",
          "vitest/require-test-timeout": "off",
          "vitest/valid-expect": ["error", { maxArgs: 2 }],
        },
      },
      {
        files: [
          "libs/ui/src/shared/ui/table.stories.tsx",
          "libs/ui/src/shared/ui/table-cell.stories.tsx",
          "libs/ui/src/shared/ui/table-head.stories.tsx",
        ],
        rules: { "react/jsx-max-depth": "off" },
      },
      {
        files: ["**/*.stories.tsx"],
        rules: {
          "import/group-exports": "off",
          "import/no-relative-parent-imports": "off",
          "typescript/prefer-readonly-parameter-types": "off",
        },
      },
    ],
    plugins: [
      "eslint",
      "typescript",
      "unicorn",
      "oxc",
      "react",
      "jsx-a11y",
      "import",
      "promise",
      "node",
      "jsdoc",
    ],
    rules: {
      "eslint/func-style": ["error", "declaration"],
      "eslint/max-lines": ["error", { max: 500 }],
      "eslint/new-cap": ["error", { capIsNewExceptionPattern: "^(?:Schema|Context|Data)\\." }],
      "eslint/no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
      "eslint/no-magic-numbers": [
        "error",
        {
          ignore: [0, 1, -1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreTypeIndexes: true,
        },
      ],
      "eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              message: "@template/ui の shadcn/ui (Base UI) 部品を使ってください。",
              name: "smarthr-ui",
            },
            {
              message: "Tailwind CSS v4 のユーティリティを使ってください。",
              name: "styled-components",
            },
            { message: "Paraglide JS を使ってください。", name: "react-intl" },
          ],
        },
      ],
      "eslint/no-ternary": "off",
      "eslint/no-undef": "off",
      "eslint/no-undefined": "off",
      "eslint/no-underscore-dangle": ["error", { allow: ["_tag"] }],
      "eslint/no-void": ["error", { allowAsStatement: true }],
      "eslint/one-var": ["error", "never"],
      "eslint/require-await": "off",
      "eslint/sort-imports": ["error", { ignoreDeclarationSort: true }],
      "import/no-cycle": "error",
      "import/no-named-export": "off",
      "import/prefer-default-export": "off",
      "node/no-top-level-await": "off",
      "oxc/no-async-await": "off",
      "oxc/no-optional-chaining": "off",
      "oxc/no-rest-spread-properties": "off",
      "project/boundaries": "error",
      "project/effect-failures": "error",
      "project/effect-stack": "error",
      "project/environment-boundary": "error",
      "project/layers": "error",
      "project/no-internal-mocks": "error",
      "project/no-manual-memoization": "error",
      "project/test-import-graph": "error",
      "project/test-runtime": "error",
      "project/worker-fetch": "error",
      "react/exhaustive-deps": "error",
      "react/forbid-component-props": "error",
      "react/jsx-filename-extension": ["error", { extensions: [".tsx"] }],
      "react/jsx-no-literals": "off",
      "react/jsx-props-no-spreading": "error",
      "react/only-export-components": ["error", { allowExportNames: ["Route"] }],
      "react/react-in-jsx-scope": "off",
      "react/rules-of-hooks": "error",
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-raw-colors": "error",
      "shadcn/no-restyle": ["error", { allow: ["layout", "spacing"] }],
      "shadcn/no-unknown-classes": "error",
      "typescript/consistent-return": "off",
      "typescript/explicit-function-return-type": [
        "error",
        { allowedNames: ["createApi", "createAuth"] },
      ],
      "typescript/explicit-module-boundary-types": [
        "error",
        { allowedNames: ["createApi", "createAuth"] },
      ],
      "typescript/no-explicit-any": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-unsafe-argument": "error",
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/only-throw-error": [
        "error",
        {
          allow: [
            { from: "package", name: "NotFoundError", package: "@tanstack/router-core" },
            { from: "package", name: "Redirect", package: "@tanstack/router-core" },
          ],
        },
      ],
      "typescript/require-await": "off",
      "unicorn/no-array-method-this-argument": "off",
      "unicorn/text-encoding-identifier-case": ["error", { withDash: true }],
      "unicorn/throw-new-error": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    settings: {
      "jsx-a11y": {
        attributes: { href: ["href", "to"] },
        components: {
          ...Object.fromEntries(linkComponents.map((name) => [name, "a"])),
          Button: "button",
          Heading: "h2",
        },
        polymorphicPropName: "as",
      },
      react: { linkComponents: linkComponents.map((name) => ({ attribute: "to", name })) },
    },
  },
  plugins: [{ enforce: "pre", name: "text-modules", transform: textModule }],
  run: {
    tasks: {
      build: [
        "vp run -F '!typescript-template' build",
        "vp run --filter @template/dev private-maps",
      ],
      check: {
        command: [
          "vp check",
          "vp run knip",
          "vp run check:client",
          "vp run check:layers",
          "vp run check:staged",
          "vp run check:effect",
          "vp run -F '!typescript-template' check",
        ],
        input: [...taskInput],
      },
      "check:client": { cache: false, command: "node tools/quality/client-bundle.ts" },
      "check:effect": { cache: false, command: "node tools/quality/effect-diagnostics.ts" },
      "check:layers": applications.map((app) => `steiger apps/${app}/src --fail-on-warnings`),
      "check:staged": { cache: false, command: "node tools/quality/check-staged.ts" },
      knip: {
        command: ["knip", "knip --strict"],
        input: [...taskInput, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
    },
  },
  test: {
    clearMocks: false,
    forceRerunTriggers: [
      "**/package.json",
      "**/tsconfig*.json",
      "pnpm-lock.yaml",
      "**/{vitest,vite}.config.*",
      "**/vitest.*.config.*",
      "libs/ui/.storybook/**",
      "libs/db/migrations/**",
      "libs/config/src/worker.ts",
      "tools/quality/test-runtime.ts",
    ].map((pattern) => `${import.meta.dirname}/${pattern}`),
    projects: [
      {
        extends: true,
        test: {
          exclude: [...defaultExclude, workerTests],
          include: [
            "libs/**/*.test.ts",
            "apps/**/*.test.ts",
            "tools/quality/**/*.test.ts",
            "tools/observe/**/*.test.ts",
            "infra/**/*.test.ts",
          ],
          name: "node",
        },
      },
      "./tools/quality/vitest.workers.config.ts",
      "./libs/ui/.storybook/vitest.config.ts",
    ],
    restoreMocks: false,
    testTimeout: 30_000,
  },
});
