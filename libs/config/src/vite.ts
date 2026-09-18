import { readFile } from "node:fs/promises";
import path from "node:path";

import react from "@vitejs/plugin-react";

import { applicationPorts, type Application } from "./applications.ts";

import type { Plugin, PluginOption, ServerOptions, UserConfig } from "vite-plus";

const readDevVars = async (appRoot: string): Promise<string | undefined> => {
  try {
    return await readFile(path.join(appRoot, ".dev.vars"), "utf-8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
};

const previewDevVars = (appRoot: string): Plugin => {
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
};

const serverOnlyFiles: (string | RegExp)[] = [
  "**/libs/auth/src/**",
  "**/libs/db/src/**",
  "**/libs/runtime/src/**",
  "**/src/**/server-api/**",
];
const clientReachableFiles: (string | RegExp)[] = [
  "**/node_modules/**",
  "**/libs/runtime/src/{client,contracts}.ts",
];
const startOptions = {
  importProtection: { client: { excludeFiles: clientReachableFiles, files: serverOnlyFiles } },
  router: {
    entry: "app/router.tsx",
    generatedRouteTree: "app/routeTree.gen.ts",
    routesDirectory: "app/routes",
  },
  start: { entry: "app/start.ts" },
};
const serverOnlyMarkers: readonly string[] = [
  "ELYSIA_REQUEST_ID",
  "better-auth/api",
  "drizzle:entityKind",
];

const envFileLoader = "tanstack-start-core:load-env";

const isEnvFileLoader = (plugin: PluginOption): boolean =>
  typeof plugin === "object" &&
  plugin !== null &&
  !Array.isArray(plugin) &&
  "name" in plugin &&
  plugin.name === envFileLoader;

const containsEnvFileLoader = (plugins: readonly PluginOption[]): boolean =>
  plugins.some((plugin) =>
    Array.isArray(plugin) ? containsEnvFileLoader(plugin) : isEnvFileLoader(plugin),
  );

const strip = (plugins: readonly PluginOption[]): PluginOption[] =>
  plugins.flatMap((plugin: PluginOption): PluginOption[] => {
    if (Array.isArray(plugin)) {
      return [strip(plugin)];
    }
    return isEnvFileLoader(plugin) ? [] : [plugin];
  });

const withoutEnvFileLoader = (plugins: readonly PluginOption[]): PluginOption[] => {
  if (!containsEnvFileLoader(plugins)) {
    throw new Error(`${envFileLoader} plugin not found`);
  }
  return strip(plugins);
};

const reactCompiler = (): PluginOption[] => {
  return react({ compiler: { logDiagnostics: true } });
};

const appServer = (app: Application): ServerOptions => {
  return {
    allowedHosts: [".local"],
    host: "127.0.0.1",
    port: applicationPorts[app],
    strictPort: true,
  };
};

const taskInput = [
  { auto: true },
  { base: "workspace", pattern: "!node_modules/.modules.yaml" },
] as const;

const appRun = {
  tasks: { build: { command: "vp build", input: [...taskInput, "!.wrangler/**", "!dist"] } },
} satisfies UserConfig["run"];

const monitorWorker = {
  pack: {
    deps: {
      alwaysBundle: ["effect", "@template/config", "@template/monitor"],
      onlyBundle: ["effect", "@template/config", "@template/monitor"],
    },
    entry: { index: "src/worker.ts" },
    format: "esm",
    outExtensions: (): { js: string } => ({ js: ".js" }),
    platform: "browser",
    target: "es2023",
  },
  run: { tasks: { build: { command: "vp pack", input: [...taskInput] } } },
} satisfies UserConfig;

export {
  appRun,
  appServer,
  monitorWorker,
  previewDevVars,
  reactCompiler,
  serverOnlyMarkers,
  startOptions,
  taskInput,
  withoutEnvFileLoader,
};
