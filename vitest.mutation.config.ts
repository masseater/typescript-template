import base from "./vite.config.ts";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    projects: [
      {
        extends: true,
        test: {
          include: [
            "libs/config/**/*.test.ts",
            "libs/runtime/**/*.test.ts",
            "tools/quality/**/*.test.ts",
          ],
          name: "mutation",
        },
      },
    ],
  },
});
