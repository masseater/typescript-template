import type { Plugin, ServerOptions } from "vite-plus";
import type { Application } from "./applications.ts";
import { applicationPorts } from "./applications.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";

async function readDevVars(appRoot: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(appRoot, ".dev.vars"), "utf-8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function previewDevVars(appRoot: string): Plugin {
  return {
    apply: "build",
    applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "ssr",
    async generateBundle() {
      const source = await readDevVars(appRoot);
      if (source !== undefined) {
        this.emitFile({ fileName: ".dev.vars", source, type: "asset" });
      }
    },
    name: "template-preview-dev-vars",
  };
}

function appServer(app: Application): ServerOptions {
  return {
    allowedHosts: [".local"],
    host: "127.0.0.1",
    port: applicationPorts[app],
    strictPort: true,
  };
}

export { appServer, previewDevVars };
