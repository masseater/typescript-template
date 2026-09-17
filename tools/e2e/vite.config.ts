import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: { include: ["src/pure.test.ts", "src/artifact-policy.test.ts"] },
});
