import type { Plugin, PluginOption, ServerOptions, UserConfig } from "vite-plus";
import type { Application } from "./applications.ts";
import { applicationPorts } from "./applications.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import react from "@vitejs/plugin-react";
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

const envFileLoader = "tanstack-start-core:load-env";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function withoutEnvFileLoader(plugins: readonly PluginOption[]): PluginOption[] {
  let removed = 0;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  function strip(options: readonly PluginOption[]): PluginOption[] {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    return options.flatMap((plugin: PluginOption): PluginOption[] => {
      if (Array.isArray(plugin)) {
        return [strip(plugin)];
      }
      if (
        typeof plugin === "object" &&
        plugin !== null &&
        "name" in plugin &&
        plugin.name === envFileLoader
      ) {
        removed += 1;
        return [];
      }
      return [plugin];
    });
  }
  const kept = strip(plugins);
  if (removed === 0) {
    throw new Error(`${envFileLoader} plugin not found`);
  }
  return kept;
}

function reactCompiler(): PluginOption[] {
  return react({ compiler: true });
}

function appServer(app: Application): ServerOptions {
  return {
    allowedHosts: [".local"],
    host: "127.0.0.1",
    port: applicationPorts[app],
    strictPort: true,
  };
}

const appRun = {
  tasks: { build: { command: "vp build", input: [{ auto: true }, "!.wrangler/**", "!dist"] } },
} satisfies UserConfig["run"];

export { appRun, appServer, previewDevVars, reactCompiler, withoutEnvFileLoader };
