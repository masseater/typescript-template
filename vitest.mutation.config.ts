import { workerTests } from "@repo/dont-review-it/test-runtime";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

import base from "./vite.config.ts";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    projects: [
      {
        extends: true,
        test: {
          exclude: [...defaultExclude, workerTests, "**/*.sandbox-unsafe.test.ts"],
          include: [
            "libs/config/**/*.test.ts",
            "libs/runtime/**/*.test.ts",
            "tools/dont-review-it/src/repository/**/*.test.ts",
          ],
          name: "mutation",
        },
      },
    ],
  },
});
