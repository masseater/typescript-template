import { applications } from "@template/config";
import { defaultExclude } from "vite-plus/test/config";
import { defineConfig } from "vite-plus";
import { lint } from "./tools/quality/lint.ts";
import { taskInput } from "@template/config/vite";
import { workerTests } from "./tools/quality/test-runtime.ts";

const textModulePattern = /\.ya?ml$|\/\.vite-hooks\/[^/]+$/u;

function textModule(code: string, id: string): string | undefined {
  return textModulePattern.test(id) ? `export default ${JSON.stringify(code)};` : undefined;
}

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  fmt: {
    ignorePatterns: [
      "**/mockServiceWorker.js",
      "**/routeTree.gen.ts",
      ".local/**",
      ".local-agents/**",
      "**/.wrangler/**",
      "**/dist/**",
    ],
  },
  lint,
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
        command: ["knip --no-config-hints", "knip --strict"],
        input: [...taskInput, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
      mutation: { cache: false, command: "stryker run tools/quality/stryker.ts" },
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
