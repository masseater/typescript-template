import { defineConfig } from "vite-plus";

import base from "./vite.config.ts";

const [node] = base.test?.projects ?? [];

if (node === undefined) {
  throw new Error("vite.config.ts declares no test project to mutate against");
}

export default defineConfig({ ...base, test: { ...base.test, projects: [node] } });
