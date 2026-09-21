import { defineConfig } from "vite-plus";

import { testableLibraryRun } from "./src/vite.ts";

export default defineConfig({ run: testableLibraryRun });
