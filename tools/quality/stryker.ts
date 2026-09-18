const configuration = {
  coverageAnalysis: "perTest",
  ignorePatterns: ["**/tsconfig*.json"],
  mutate: [
    "libs/config/src/applications.ts",
    "libs/config/src/index.ts",
    "libs/runtime/src/contracts.ts",
    "libs/runtime/src/failures.ts",
    "libs/runtime/src/http.ts",
    "libs/runtime/src/responses.ts",
    "tools/quality/*.ts",
    "!tools/quality/*.test.ts",
    "!tools/quality/check-staged.ts",
    "!tools/quality/client-bundle.ts",
    "!tools/quality/dependencies.ts",
    "!tools/quality/design-system.ts",
    "!tools/quality/effect-diagnostics.ts",
    "!tools/quality/lint-harness.ts",
    "!tools/quality/part-stories.ts",
    "!tools/quality/stryker.ts",
  ],
  packageManager: "pnpm",
  plugins: ["@stryker-mutator/vitest-runner"],
  reporters: ["progress", "clear-text"],
  tempDirName: ".local/stryker",
  testRunner: "vitest",
  thresholds: { break: 68, high: 80, low: 70 },
  vitest: { configFile: "vitest.mutation.config.ts" },
};

// oxlint-disable-next-line import/no-default-export
export default configuration;
