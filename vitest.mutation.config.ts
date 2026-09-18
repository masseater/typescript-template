import { defineConfig } from "vite-plus";

import base from "./vite.config.ts";

const [node] = base.test?.projects ?? [];

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  ...base,
  test: { ...base.test, projects: node === undefined ? [] : [node] },
});
