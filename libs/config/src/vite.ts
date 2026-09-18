import { readFile } from "node:fs/promises";
import path from "node:path";

import react from "@vitejs/plugin-react";

import { applicationPorts, loopbackAddress, type Application } from "./applications.ts";

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

const serverOnlyPackages = ["auth", "db", "runtime"] as const;
const clientReachableModules = [
  "libs/runtime/src/client.ts",
  "libs/runtime/src/contracts.ts",
] as const;
const serverOnlyFiles: (string | RegExp)[] = [
  ...serverOnlyPackages.map((packageName) => `**/libs/${packageName}/src/**`),
  "**/src/**/server-api/**",
];
const clientReachableFiles: (string | RegExp)[] = [
  "**/node_modules/**",
  ...clientReachableModules.map((module) => `**/${module}`),
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
    host: loopbackAddress,
    port: applicationPorts[app],
    strictPort: true,
  };
};

const taskInput = [
  { auto: true },
  { base: "workspace", pattern: "!node_modules/.modules.yaml" },
] as const;

const effectDiagnostics = {
  "check:effect": {
    command:
      "effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning",
    input: [...taskInput],
  },
} satisfies NonNullable<UserConfig["run"]>["tasks"];

type RunConfig = NonNullable<UserConfig["run"]>;
type Tasks = NonNullable<RunConfig["tasks"]>;

const lifecycles = ["precommit", "prepush", "premerge"] as const;
type Lifecycle = (typeof lifecycles)[number];

const lifecycle = (stages: Readonly<Record<Lifecycle, readonly string[]>>): Tasks =>
  Object.fromEntries(
    lifecycles.map((name, index) => [
      name,
      {
        command: [],
        dependsOn: [...lifecycles.slice(Math.max(index - 1, 0), index), ...stages[name]],
      },
    ]),
  );

const effectRun = {
  tasks: {
    ...effectDiagnostics,
    ...lifecycle({ precommit: [], premerge: [], prepush: ["check:effect"] }),
  },
} satisfies RunConfig;

const appRun = {
  tasks: {
    ...effectDiagnostics,
    build: { command: "vp build", input: [...taskInput, "!.wrangler/**", "!dist"] },
    "check:dev": {
      cache: false,
      command: "dev-start",
      dependsOn: ["@repo/dev#setup", "@repo/db#db:migrate:local"],
    },
    ...lifecycle({
      precommit: [],
      premerge: ["build", "check:dev"],
      prepush: ["check:effect", "check"],
    }),
  },
} satisfies RunConfig;

export {
  appRun,
  appServer,
  clientReachableModules,
  effectDiagnostics,
  effectRun,
  lifecycle,
  lifecycles,
  previewDevVars,
  reactCompiler,
  serverOnlyMarkers,
  serverOnlyPackages,
  startOptions,
  taskInput,
  withoutEnvFileLoader,
};
export { privateSourceMaps } from "./private-source-maps.ts";
export type { Tasks };
