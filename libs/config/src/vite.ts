import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite-plus";

export function previewDevVars(appRoot: string): Plugin {
  return {
    name: "template-preview-dev-vars",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "ssr",
    async generateBundle() {
      const source = await readFile(path.join(appRoot, ".dev.vars"), "utf8").catch(
        (error: unknown) => {
          if (error instanceof Error && "code" in error && error.code === "ENOENT")
            return undefined;
          throw error;
        },
      );
      if (source !== undefined) this.emitFile({ type: "asset", fileName: ".dev.vars", source });
    },
  };
}
