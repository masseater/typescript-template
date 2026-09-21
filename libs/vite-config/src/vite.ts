import { readFile } from "node:fs/promises";
import path from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import { applicationPorts, loopbackAddress, type Application } from "@repo/config";
import { localDatabase, localDatabaseDirectory } from "@repo/config/local-database-path";
import { repositoryRoot } from "@repo/config/repository-root";
import { workerCompatibility } from "@repo/config/worker";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

import { devBoundary } from "./dev-boundary.ts";
import { failOnBrokenSourceMaps, privateSourceMaps } from "./private-source-maps.ts";

import type { ConfigEnv, Plugin, PluginOption, ServerOptions, UserConfig } from "vite-plus";

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
      if (source === undefined) {
        return this.error(
          `Missing ${path.join(appRoot, ".dev.vars")}; run vp run --filter @repo/dev setup before building for preview`,
        );
      }
      this.emitFile({ fileName: ".dev.vars", source, type: "asset" });
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

const typecheckInputs = [
  ...taskInput,
  { base: "workspace", pattern: "**/*.{ts,tsx}" },
  { base: "workspace", pattern: "**/package.json" },
  { base: "workspace", pattern: "**/tsconfig*.json" },
  { base: "workspace", pattern: "**/effect-typecheck-baseline.json" },
  { base: "workspace", pattern: "!**/node_modules/**" },
  { base: "workspace", pattern: "!**/dist/**" },
  { base: "workspace", pattern: "!**/.paraglide/**" },
  { base: "workspace", pattern: "!**/.local/**" },
] as const;

const effectDiagnostics = {
  "check:effect:gate": {
    command: "check-effect-typecheck",
    input: [...typecheckInputs],
  },
  "check:effect": {
    command:
      "effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning",
    dependsOn: ["check:effect:gate"],
    input: [...typecheckInputs],
  },
} satisfies NonNullable<UserConfig["run"]>["tasks"];

type RunConfig = NonNullable<UserConfig["run"]>;
type Tasks = NonNullable<RunConfig["tasks"]>;

const lifecycles = ["precommit", "prepush", "prepr", "premerge", "prerelease"] as const;
type Lifecycle = (typeof lifecycles)[number];

const lifecycleInherits: Readonly<Record<Lifecycle, readonly Lifecycle[]>> = {
  precommit: [],
  prepush: ["precommit"],
  prepr: ["prepush"],
  premerge: [],
  prerelease: ["prepr", "premerge"],
};

type LifecycleTask = {
  command: string[];
  dependsOn: string[];
};

function lifecycle(stages: Readonly<Partial<Record<Lifecycle, readonly string[]>>> = {}): {
  readonly precommit: LifecycleTask;
  readonly prepush: LifecycleTask;
  readonly prepr: LifecycleTask;
  readonly premerge: LifecycleTask;
  readonly prerelease: LifecycleTask;
} {
  return {
    precommit: {
      command: [],
      dependsOn: [...lifecycleInherits.precommit, ...(stages.precommit ?? [])],
    },
    prepush: {
      command: [],
      dependsOn: [...lifecycleInherits.prepush, ...(stages.prepush ?? [])],
    },
    prepr: {
      command: [],
      dependsOn: [...lifecycleInherits.prepr, ...(stages.prepr ?? [])],
    },
    premerge: {
      command: [],
      dependsOn: [...lifecycleInherits.premerge, ...(stages.premerge ?? [])],
    },
    prerelease: {
      command: [],
      dependsOn: [...lifecycleInherits.prerelease, ...(stages.prerelease ?? [])],
    },
  };
}

const testTaskInput = [
  ...taskInput,
  "!coverage/**",
  { base: "workspace", pattern: "!**/coverage/**" },
  { base: "workspace", pattern: "pnpm-lock.yaml" },
  { base: "workspace", pattern: "pnpm-workspace.yaml" },
] as const;

const testRun = {
  test: {
    command: "vp test run --exclude '**/*.worker.test.ts'",
    input: [...testTaskInput],
    output: [],
  },
} satisfies Tasks;

const testCoverageRun = {
  test: {
    command: "vp test run --coverage",
    input: [...testTaskInput],
    output: [{ base: "workspace", pattern: "coverage/**" }],
  },
} satisfies Tasks;

const checkCode = {
  "check:code": {
    command: "vp check --no-error-on-unmatched-pattern",
    input: [...taskInput],
  },
} satisfies Tasks;

const workspaceCheckImports = {
  "check:imports": {
    command: "../../tools/dont-review-it/src/repository/workspace-imports.ts",
    input: [...taskInput],
  },
} satisfies Tasks;

const sliceBoundaries = {
  check: { command: "steiger src --fail-on-warnings", input: [...taskInput] },
} satisfies Tasks;

const intentValidation = {
  check: { command: "intent validate", input: [...taskInput] },
} satisfies Tasks;

const inspectedLibraryRun = {
  tasks: {
    ...effectDiagnostics,
    ...checkCode,
    ...workspaceCheckImports,
    ...lifecycle({
      precommit: ["check:code"],
      prepush: ["check:effect", "check:imports"],
    }),
  },
} satisfies RunConfig;

const testableLibraryRun = {
  tasks: {
    ...inspectedLibraryRun.tasks,
    ...testRun,
    ...lifecycle({
      precommit: ["check:code"],
      prepush: ["check:effect", "check:imports"],
      premerge: ["test"],
    }),
  },
} satisfies RunConfig;

const coveredTestableLibraryRun = {
  tasks: {
    ...inspectedLibraryRun.tasks,
    ...testCoverageRun,
    ...lifecycle({
      precommit: ["check:code"],
      prepush: ["check:effect", "check:imports"],
      premerge: ["test"],
    }),
  },
} satisfies RunConfig;

const effectRun = inspectedLibraryRun;

function appRun(app: Application): RunConfig {
  return {
    tasks: {
      ...effectDiagnostics,
      ...sliceBoundaries,
      ...checkCode,
      ...workspaceCheckImports,
      ...testRun,
      "check:client": {
        command: `quality-check-client --application ${app}`,
        input: [
          ...taskInput,
          "!**/dist/**",
          "!**/node_modules/.cache/**",
          { base: "workspace", pattern: "!.local" },
          { base: "workspace", pattern: "!.local/**" },
        ],
        output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
      },
      "check:react": {
        command: `quality-check-react --application ${app}`,
        input: [...taskInput, "!**/node_modules/.cache/**", "!**/dist/**"],
        output: [{ auto: true }, "!**/node_modules/.cache/**"],
      },
      build: {
        command: "vp build",
        dependsOn: ["@repo/dev#setup", "check:effect"],
        input: [...taskInput, ...withoutGenerated(".wrangler", "dist"), ...withoutLocalState],
        output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
      },
      "check:dev": {
        cache: false,
        command: "../../tools/dev/src/dev-start.ts",
        dependsOn: ["@repo/dev#setup"],
        input: [
          ...taskInput,
          ...withoutGenerated(".wrangler", "dist"),
          "!node_modules/.mf/**",
          ...withoutLocalState,
          { base: "workspace", pattern: "libs/db/migrations/**" },
        ],
        output: [],
      },
      dev: { cache: false, command: "vp dev" },
      preview: { cache: false, command: "vp preview" },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check", "check:imports", "check:react", "check:client"],
        prepr: ["build"],
        premerge: ["test", "check:dev"],
      }),
    },
  };
}

const toolTest: NonNullable<UserConfig["test"]> = {
  mockReset: true,
  restoreMocks: true,
  coverage: {
    exclude: ["specs/**"],
    thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
  },
  unstubEnvs: true,
  unstubGlobals: true,
};

const noExtraPlugins: readonly PluginOption[] = [];

function appConfig(
  app: Application,
  plugins: readonly PluginOption[] = noExtraPlugins,
): (env: Readonly<ConfigEnv>) => UserConfig {
  const appRoot = path.join(repositoryRoot, "apps", app);
  return ({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
    build: { sourcemap: "hidden" },
    plugins: [
      failOnBrokenSourceMaps(),
      previewDevVars(appRoot),
      privateSourceMaps(app),
      devBoundary(app),
      ...(process.env["VITEST"] === undefined)
        ? [
            cloudflare({
              config: {
                assets: {
                  binding: "ASSETS",
                  run_worker_first: command !== "serve" || isPreview === true,
                },
                compatibility_date: workerCompatibility.date,
                compatibility_flags: [...workerCompatibility.flags],
                d1_databases: [localDatabase],
                main: "./src/app/server.ts",
                name: `template-${app}`,
              },
              inspectorPort: false,
              persistState: { path: localDatabaseDirectory() },
              viteEnvironment: { name: "ssr" },
            }),
          ]
        : []),
      ...plugins,
      tailwindcss(),
      ...withoutEnvFileLoader(tanstackStart(startOptions)),
      reactCompiler(),
    ],
    preview: appServer(app),
    run: appRun(app),
    server: appServer(app),
  });
}

export {
  appConfig,
  appRun,
  appServer,
  checkCode,
  clientReachableModules,
  coveredTestableLibraryRun,
  defineConfig,
  effectDiagnostics,
  effectRun,
  inspectedLibraryRun,
  intentValidation,
  lifecycle,
  lifecycleInherits,
  lifecycles,
  previewDevVars,
  reactCompiler,
  serverOnlyMarkers,
  serverOnlyPackages,
  generatedDirectories,
  sliceBoundaries,
  startOptions,
  taskInput,
  testCoverageRun,
  testableLibraryRun,
  testRun,
  toolTest,
  workspaceCheckImports,
  withoutEnvFileLoader,
};
export { paraglideAppPlugin, paraglideStrategy } from "./paraglide.ts";
export { failOnBrokenSourceMaps, privateSourceMaps };
export type { Tasks };
export { devBoundary };
