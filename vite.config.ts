import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    {
      name: "text-modules",
      enforce: "pre",
      transform: (code, id) =>
        /\.ya?ml$|\/\.vite-hooks\/[^/]+$/.test(id)
          ? `export default ${JSON.stringify(code)};`
          : undefined,
    },
  ],
  lint: {
    options: { typeAware: true, typeCheck: true },
    plugins: ["typescript", "react", "react-perf", "jsx-a11y", "import", "promise", "vitest"],
    jsPlugins: [
      "./tools/quality/rules.ts",
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      "@shadcn/lint",
    ],
    settings: { shadcn: { ui: "@template/ui/ui" } },
    categories: { correctness: "error", suspicious: "error" },
    overrides: [
      {
        files: ["**/*.test.ts"],
        rules: { "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }] },
      },
      {
        files: ["libs/ui/src/shared/ui/**"],
        rules: {
          "shadcn/no-restyle": "off",
          "jsx-a11y/label-has-associated-control": "off",
        },
      },
    ],
    rules: {
      "react/react-in-jsx-scope": "off",
      "vite-plus/prefer-vite-plus-imports": "error",
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
        { additionalTestBlockFunctions: ["test", "test.for"] },
      ],
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      "project/boundaries": "error",
      "project/no-internal-mocks": "error",
      "project/environment-boundary": "error",
      "project/worker-fetch": "error",
      "project/test-import-graph": "error",
      "shadcn/no-restyle": ["error", { allow: ["layout", "spacing"] }],
      "shadcn/no-raw-colors": "error",
      "shadcn/no-arbitrary-values": "error",
      "shadcn/no-unknown-classes": "error",
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
