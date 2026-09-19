// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import react from "@vitejs/plugin-react";

import { applicationPorts, loopbackAddress } from "./applications.ts";

import type { Plugin, PluginOption, ServerOptions, UserConfig } from "vite-plus";
import type { Application } from "./applications.ts";

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

const serverOnlyPackages = ["auth", "db", "runtime"] as const;
const clientReachableModules = [
  "libs/runtime/src/client.ts",
  "libs/runtime/src/contracts.ts",
] as const;
const serverOnlyFiles: (string | RegExp)[] = [
  ...serverOnlyPackages.map((name) => `**/libs/${name}/src/**`),
  "**/src/**/server-api/**",
];
const clientReachableFiles: (string | RegExp)[] = [
  "**/node_modules/**",
  ...clientReachableModules.map((file) => `**/${file}`),
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

function withoutEnvFileLoader(plugins: readonly PluginOption[]): PluginOption[] {
  let removed = 0;
  function strip(options: readonly PluginOption[]): PluginOption[] {
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
  return react({ compiler: { logDiagnostics: true } });
}

function appServer(app: Application): ServerOptions {
  return {
    allowedHosts: [".local"],
    host: loopbackAddress,
    port: applicationPorts[app],
    strictPort: true,
  };
}

const generatedDirectories = ["node_modules", ".local", "dist", ".wrangler", ".alchemy"] as const;

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

function lifecycle(stages: Readonly<Record<Lifecycle, readonly string[]>>): Tasks {
  return Object.fromEntries(
    lifecycles.map((name, index) => [
      name,
      {
        command: [],
        dependsOn: [...lifecycles.slice(Math.max(index - 1, 0), index), ...stages[name]],
      },
    ]),
  );
}

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
