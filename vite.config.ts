import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    options: { typeAware: true, typeCheck: true },
    plugins: ["typescript", "react", "react-perf", "jsx-a11y", "import", "promise", "vitest"],
    jsPlugins: ["./tools/quality/rules.ts"],
    categories: { correctness: "error", suspicious: "error" },
    overrides: [
      {
        files: ["**/*.test.ts"],
        rules: { "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }] },
      },
      {
        files: ["**/*.ts"],
        rules: { "react/rules-of-hooks": "off" },
      },
      {
        files: ["libs/ui/**"],
        rules: { "react/rules-of-hooks": "error" },
      },
    ],
    rules: {
      "react/react-in-jsx-scope": "off",
      "typescript/no-explicit-any": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/no-unsafe-argument": "error",
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "error",
      "import/no-cycle": "error",
      "vitest/no-standalone-expect": [
        "error",
        {
          additionalTestBlockFunctions: ["test", "test.for", "it.effect", "it.scoped", "it.live"],
        },
      ],
      "eslint/no-underscore-dangle": ["error", { allow: ["_tag"] }],
      "typescript/consistent-return": "off",
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      "project/boundaries": "error",
      "project/no-internal-mocks": "error",
      "project/environment-boundary": "error",
      "project/worker-fetch": "error",
      "project/effect-stack": "error",
      "project/effect-failures": "error",
    },
    ignorePatterns: [
      "**/routeTree.gen.ts",
      "**/dist/**",
      "**/node_modules/**",
      ".local/**",
      ".local-agents/**",
      "**/.wrangler/**",
    ],
  },
  fmt: {
    ignorePatterns: [
      "**/routeTree.gen.ts",
      ".local/**",
      ".local-agents/**",
      "**/.wrangler/**",
      "**/dist/**",
    ],
  },
  test: {
    include: [
      "libs/**/*.test.ts",
      "apps/**/*.test.ts",
      "tools/quality/**/*.test.ts",
      "tools/observe/**/*.test.ts",
      "infra/**/*.test.ts",
    ],
    restoreMocks: false,
    clearMocks: false,
    testTimeout: 30_000,
  },
});
