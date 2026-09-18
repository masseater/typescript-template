import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

import { taskInput } from "@repo/config/vite";

import { generatedFiles, lint } from "./tools/quality/lint.ts";
import { workerTests } from "./tools/quality/test-runtime.ts";

const textModulePattern = /\.ya?ml$|\/\.vite-hooks\/[^/]+$/u;

function textModule(code: string, id: string): string | undefined {
  return textModulePattern.test(id) ? `export default ${JSON.stringify(code)};` : undefined;
}

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  fmt: {
    ignorePatterns: generatedFiles,
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
      check: {
        command: [
          "vp check",
          "vp run knip",
          "vp run check:client",
          "vp run check:staged",
          "vp run check:effect",
          "vp run -F '!typescript-template' --cache check",
        ],
        input: [...taskInput],
      },
      "check:client": { command: "node tools/quality/client-bundle.ts", input: [...taskInput] },
      "check:effect": {
        command: "node tools/quality/effect-diagnostics.ts",
        input: [...taskInput],
      },
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
