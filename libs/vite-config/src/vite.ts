import { readFile } from "node:fs/promises";
import path from "node:path";

import { applicationPorts, loopbackAddress, type Application } from "@repo/config";
import { workerCompatibility } from "@repo/config/worker";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

import type { Plugin, PluginOption, ServerOptions, UserConfig } from "vite-plus";

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
  "libs/runtime/src/security.ts",
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

function withoutGenerated(...directories: readonly string[]): string[] {
  return directories.flatMap((directory) => [`!${directory}`, `!${directory}/**`]);
}

const withoutLocalState = [
  { base: "workspace", pattern: "!.local" },
  { base: "workspace", pattern: "!.local/**" },
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
    build: {
      command: "vp build",
      dependsOn: ["@repo/dev#setup"],
      input: [...taskInput, ...withoutGenerated(".wrangler", "dist"), ...withoutLocalState],
      output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
    },
    "check:dev": {
      command: "dev-start",
      dependsOn: ["@repo/dev#setup", "@repo/db-local#db:migrate:local"],
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

const toolTest: NonNullable<UserConfig["test"]> = {
  mockReset: true,
  restoreMocks: true,
  coverage: {
    exclude: ["specs/**"],
    thresholds: { 100: true, perFile: true },
  },
  unstubEnvs: true,
  unstubGlobals: true,
};

function appCloudflare(
  app: Application,
  options: {
    readonly command: "build" | "serve";
    readonly isPreview: boolean | undefined;
    readonly database: {
      readonly binding: string;
      readonly database_id: string;
      readonly database_name: string;
    };
    readonly persistState: string;
  },
): {
  readonly config: {
    readonly assets: { readonly binding: "ASSETS"; readonly run_worker_first: boolean };
    readonly compatibility_date: string;
    readonly compatibility_flags: readonly string[];
    readonly d1_databases: readonly unknown[];
    readonly main: "./src/app/server.ts";
    readonly name: string;
  };
  readonly inspectorPort: false;
  readonly persistState: { readonly path: string };
  readonly viteEnvironment: { readonly name: "ssr" };
} {
  return {
    config: {
      assets: {
        binding: "ASSETS",
        run_worker_first: options.command !== "serve" || options.isPreview === true,
      },
      compatibility_date: workerCompatibility.date,
      compatibility_flags: [...workerCompatibility.flags],
      d1_databases: [options.database],
      main: "./src/app/server.ts",
      name: `template-${app}`,
    },
    inspectorPort: false,
    persistState: { path: options.persistState },
    viteEnvironment: { name: "ssr" },
  };
}

export {
  appCloudflare,
  appRun,
  appServer,
  clientReachableModules,
  defineConfig,
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
  toolTest,
  withoutEnvFileLoader,
};
export { failOnBrokenSourceMaps, privateSourceMaps } from "./private-source-maps.ts";
export type { Tasks };
