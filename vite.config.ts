import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

import { taskInput } from "@repo/config/vite";

import { generatedFiles, importedToolPatterns, lint } from "./tools/quality/lint.ts";
import { workerTests } from "./tools/quality/test-runtime.ts";

const textModulePattern = /\.ya?ml$|\/\.vite-hooks\/[^/]+$/u;

function textModule(code: string, id: string): string | undefined {
  return textModulePattern.test(id) ? `export default ${JSON.stringify(code)};` : undefined;
}

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  fmt: {
    ignorePatterns: [...generatedFiles, ...importedToolPatterns],
    sortImports: { internalPattern: ["@repo/"], newlinesBetween: true },
    sortPackageJson: { sortScripts: true },
    sortTailwindcss: { functions: ["cn", "cva"], stylesheet: "./libs/ui/src/styles.css" },
  },
  lint,
  plugins: [{ enforce: "pre", name: "text-modules", transform: textModule }],
  run: {
    tasks: {
      build: [
        "vp run -F '!typescript-template' build",
        "vp run --filter @repo/dev private-maps",
        "vp run --filter @repo/infra-cloudflare verify:artifacts",
        "vp run --filter @repo/infra-cloudflare verify:stacks",
      ],
      check: ["vp run precommit", "vp run prepush"],
      "check:client": { command: "node tools/quality/client-bundle.ts", input: [...taskInput] },
      "check:dev": {
        command: "node tools/quality/dev-start.ts",
        input: [
          ...taskInput,
          { base: "workspace", pattern: "!.local/**" },
          { base: "workspace", pattern: "!apps/*/.dev.vars" },
          { base: "workspace", pattern: "!node_modules/.vite/**" },
        ],
      },
      "check:effect": {
        command: [
          "effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning",
          "vp run -F '!typescript-template' --cache check:effect",
        ],
        input: [...taskInput],
      },
      "check:imports":
        "depcruise --config tools/quality/dependency-cruiser.ts --output-type err-long apps libs infra tools",
      "check:react": {
        command: "node tools/quality/react-doctor.ts",
        input: [...taskInput, "!**/node_modules/.cache/**", "!**/dist/**"],
        output: [{ auto: true }, "!**/node_modules/.cache/**"],
      },
      "check:staged": { cache: false, command: "node tools/quality/check-staged.ts" },
      knip: {
        command: ["knip", "knip --strict"],
        input: [...taskInput, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
      precommit: { command: ["vp check", "vp run check:staged"], input: [...taskInput] },
      prepush: [
        "vp run knip",
        "vp run check:client",
        "vp run check:imports",
        "vp run check:react",
        "vp run check:effect",
        "vp run check:dev",
        "vp run -F '!typescript-template' --cache check",
      ],
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
            "tools/load/**/*.test.ts",
            "tools/observe/**/*.test.ts",
            "infra/**/*.test.ts",
          ],
          name: "node",
        },
      },
      "./tools/quality/vitest.workers.config.ts",
      "./libs/ui/.storybook/vitest.config.ts",
      "./tools/ai-native",
      "./tools/dont-review-it",
      "./tools/lint-rule-authoring",
      "./tools/repository-checks",
      "./tools/stop-ai-slop",
    ],
    restoreMocks: false,
    testTimeout: 30_000,
  },
});
