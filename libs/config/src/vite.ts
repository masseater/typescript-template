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

const clientReachableModules = [
  "libs/runtime/src/client.ts",
  "libs/runtime/src/contracts.ts",
] as const;
const serverOnlyPackages = ["auth", "db", "runtime"] as const;
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

const generatedDirectories = [
  "node_modules",
  ".local",
  "dist",
  ".wrangler",
  ".alchemy",
  ".artifacts",
  ".spool",
] as const;

const taskInput = [
  { auto: true },
  { base: "workspace", pattern: "!node_modules/.modules.yaml" },
  { base: "workspace", pattern: "!**/node_modules/.bin/**" },
] as const;

const withoutGenerated = function withoutGenerated(...directories: readonly string[]): string[] {
  return directories.flatMap((directory) => [`!${directory}`, `!${directory}/**`]);
};

const withoutLocalState = [
  { base: "workspace", pattern: "!.local" },
  { base: "workspace", pattern: "!.local/**" },
] as const;

type RunConfig = NonNullable<UserConfig["run"]>;
type Tasks = NonNullable<RunConfig["tasks"]>;

const testRun = {
  test: {
    command: "vp test run",
    input: [
      ...taskInput,
      "!coverage/**",
      { base: "workspace", pattern: "!**/coverage/**" },
      { base: "workspace", pattern: "pnpm-lock.yaml" },
      { base: "workspace", pattern: "pnpm-workspace.yaml" },
    ],
    output: [],
  },
} satisfies Tasks;

const sliceBoundaries = {
  check: { command: "steiger src --fail-on-warnings", input: [...taskInput] },
} satisfies Tasks;

const intentValidation = {
  check: { command: "intent validate", input: [...taskInput] },
} satisfies Tasks;

const effectDiagnostics = {
  "check:effect": {
    command:
      "effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning",
    input: [...taskInput],
  },
} satisfies NonNullable<UserConfig["run"]>["tasks"];

const lifecycles = ["precommit", "prepush", "premerge"] as const;

const lifecycle = (
  stages: Readonly<Record<(typeof lifecycles)[number], readonly string[]>>,
): Tasks =>
  Object.fromEntries(
    lifecycles.map((stage, index) => [
      stage,
      {
        command: [],
        dependsOn: [...lifecycles.slice(Math.max(index - 1, 0), index), ...stages[stage]],
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
    ...sliceBoundaries,
    build: {
      command: "vp build",
      dependsOn: ["@repo/dev#setup"],
      input: [...taskInput, ...withoutGenerated(".wrangler", "dist"), ...withoutLocalState],
      output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
    },
    "check:dev": {
      command: "dev-start",
      dependsOn: ["@repo/dev#setup", "@repo/db#db:migrate:local"],
      input: [
        ...taskInput,
        ...withoutGenerated(".wrangler", "dist"),
        "!node_modules/.mf/**",
        ...withoutLocalState,
        { base: "workspace", pattern: "libs/db/migrations/**" },
      ],
      output: [],
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
  intentValidation,
  lifecycle,
  lifecycles,
  previewDevVars,
  reactCompiler,
  serverOnlyMarkers,
  serverOnlyPackages,
  generatedDirectories,
  sliceBoundaries,
  startOptions,
  taskInput,
  testRun,
  withoutEnvFileLoader,
};
export { failOnBrokenSourceMaps, privateSourceMaps } from "./private-source-maps.ts";
export type { Tasks };
