import { cloudflare } from "@cloudflare/vite-plugin";
import {
  applicationPorts,
  coreEntrypoints,
  grants,
  jobsQueueBinding,
  jobsQueueName,
  jobsWorkflowBinding,
  jobsWorkflowClass,
  jobsWorkflowName,
  loopbackAddress,
  wikiBasePath,
  wikiHost,
  wikiPort,
  wikiServerFnBase,
  wikiWorker,
  type Application,
} from "@repo/config";
import { localDatabase, localDatabaseDirectory } from "@repo/config/local-database-path";
import { localUserInbox, userInboxClassName } from "@repo/config/realtime";
import { repositoryRoot } from "@repo/config/repository-root";
import { localCacheNamespace, localFileBucket } from "@repo/config/storage";
import { workerCompatibility } from "@repo/config/worker";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import {
  defineConfig,
  lazyPlugins,
  type ConfigEnv,
  type PluginOption,
  type ServerOptions,
  type UserConfig,
} from "vite-plus";

import { devBoundary } from "./dev-boundary.ts";
import { coreDevWorker, coreDevWorkerName, devWorkerName } from "./dev-workers.ts";
import {
  awaitingEffectDiagnostics,
  effectDiagnostics,
  effectTsgoNoEmit,
  type EffectDiagnosticsTask,
} from "./effect-tsgo.ts";
import { elysiaAot, elysiaWorkerdJit } from "./elysia-aot.ts";
import { withoutEnvFileLoader } from "./env-file-loader.ts";
import { paths } from "./host.ts";
import { lifecycle, lifecycleInherits, lifecycles } from "./lifecycle.ts";
import { localizedApps } from "./paraglide-options.ts";
import { withoutInlangState, workspaceParaglideCompile } from "./paraglide.ts";
import { previewDevVars } from "./preview-dev-vars.ts";
import { failOnBrokenSourceMaps, privateSourceMaps } from "./private-source-maps.ts";
import { measured, telemetryEnv, type RunConfig, type Tasks } from "./run-config.ts";
import { scalarReference } from "./scalar-reference.ts";
import { taskInput } from "./task-input.ts";
import { testRun } from "./test-run.ts";
import {
  wikiCompanion,
  wikiDevServices,
  wikiDevWorkerName,
  wikiHmrPath,
} from "./wiki-companion.ts";

const clientReachableModules = [
  "libs/runtime/src/features/runtime/client.ts",
  "libs/runtime/src/features/runtime/contracts.ts",
  "libs/runtime/src/features/runtime/security.ts",
] as const;
const serverOnlyPackages = ["auth", "db", "runtime"] as const;
const serverOnlyFiles: (string | RegExp)[] = [
  ...serverOnlyPackages.map(
    (packageDirectory) => `**/libs/${packageDirectory}/src/features/${packageDirectory}/**`,
  ),
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

const reactCompiler = (): PluginOption[] => react({ compiler: { logDiagnostics: true } });

const appServer = (app: Application): ServerOptions => ({
  allowedHosts: [".local"],
  host: loopbackAddress,
  port: applicationPorts[app],
  strictPort: true,
});

const generatedDirectories = [
  "node_modules",
  ".local",
  "dist",
  ".wrangler",
  ".alchemy",
  ".artifacts",
  ".spool",
] as const;

const withoutGenerated = (...directories: readonly string[]): string[] =>
  directories.flatMap((directory) => [`!${directory}`, `!${directory}/**`]);

const withoutLocalState = [
  { base: "workspace", pattern: "!.local" },
  { base: "workspace", pattern: "!.local/**" },
] as const;

const sliceBoundariesInput = [
  ...taskInput,
  ...withoutLocalState,
  ...localizedApps.map((app) => ({
    base: "workspace" as const,
    pattern: `!apps/${app}/.paraglide/**`,
  })),
];

const sliceBoundaries = measured({
  "check:feature-sliced": {
    command: "dont-review-it-feature-sliced",
    input: sliceBoundariesInput,
  },
  "check:thin-app-routes": {
    command: "dont-review-it-thin-app-routes",
    input: sliceBoundariesInput,
  },
} satisfies Tasks);

const intentValidation = measured({
  check: { command: "intent validate", input: [...taskInput] },
} satisfies Tasks);

const checkCode = measured({
  "check:code": { command: "vp check --no-error-on-unmatched-pattern", input: [...taskInput] },
} satisfies Tasks);

const workspaceCheckImports = measured({
  "check:imports": { command: "dont-review-it-imports", input: [...taskInput] },
} satisfies Tasks);

const modularBoundaries = measured({
  "check:modular": { command: "dont-review-it-modular", input: [...taskInput] },
} satisfies Tasks);

const effectRunTasks = measured({
  ...checkCode,
  ...workspaceCheckImports,
  ...modularBoundaries,
  ...lifecycle({
    precommit: ["check:code"],
    prepush: ["check:effect", "check:imports", "check:modular"],
  }),
} satisfies Tasks);

const effectRun = (
  packageRoot: string,
): { tasks: typeof effectRunTasks & EffectDiagnosticsTask } => ({
  tasks: { ...effectDiagnostics(packageRoot), ...effectRunTasks },
});

const awaitingEffectRun = (
  packageRoot: string,
): { tasks: typeof effectRunTasks & EffectDiagnosticsTask } => ({
  tasks: { ...awaitingEffectDiagnostics(packageRoot), ...effectRunTasks },
});

const appChecks = measured({
  "check:client": {
    command: "dont-review-it-client",
    input: [
      ...taskInput,
      "!node_modules",
      "!**/dist/**",
      "!**/node_modules/.cache/**",
      ...withoutLocalState,
      ...withoutInlangState,
    ],
    output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
  },
  "check:react": {
    command: "dont-review-it-react",
    input: [...taskInput, "!**/node_modules/.cache/**", "!**/dist/**", ...withoutInlangState],
    output: [{ auto: true }, "!**/node_modules/.cache/**"],
  },
} satisfies Tasks);

const appPrepush = [
  "check:effect",
  "check:feature-sliced",
  "check:thin-app-routes",
  "check:imports",
  "check:client",
  "check:react",
];

const appTasks = measured({
  ...checkCode,
  ...workspaceCheckImports,
  ...appChecks,
  ...sliceBoundaries,
  build: {
    command: "vp build",
    dependsOn: ["@repo/dev#setup", "check:effect"],
    input: [
      ...taskInput,
      "!.",
      "!node_modules",
      ...withoutGenerated(".wrangler", "dist"),
      ...withoutLocalState,
      ...withoutInlangState,
    ],
    output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
  },
  "check:dev": {
    cache: false,
    command: "../../tools/dev/src/features/dev/dev-start.ts",
    dependsOn: ["@repo/dev#setup"],
  },
  dev: { cache: false, command: "vp dev" },
  preview: { cache: false, command: "vp preview" },
  ...lifecycle({
    precommit: ["check:code"],
    prepush: appPrepush,
    prepr: ["build"],
    premerge: ["build", "check:dev"],
  }),
} satisfies Tasks);

const appRun = (packageRoot: string): { tasks: typeof appTasks & EffectDiagnosticsTask } => ({
  tasks: { ...awaitingEffectDiagnostics(packageRoot), ...appTasks },
});

const paraglideCompileDependency = ["typescript-template#compile:paraglide"];

const paraglideAppTasks = measured({
  ...appTasks,
  ...Object.fromEntries(
    (["check:code", "check:imports", "check:client", "check:react"] as const).map((gatedTask) => [
      gatedTask,
      { ...appTasks[gatedTask], dependsOn: paraglideCompileDependency },
    ]),
  ),
} satisfies Tasks);

const paraglideAppRun = (packageRoot: string): RunConfig => ({
  tasks: {
    ...paraglideAppTasks,
    "check:effect": {
      ...awaitingEffectDiagnostics(packageRoot)["check:effect"],
      dependsOn: paraglideCompileDependency,
    },
  },
});

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

const appConfig = (
  app: Application,
  {
    plugins = [],
    services = [],
  }: Readonly<{
    plugins?: readonly PluginOption[];
    services?: readonly Readonly<{ binding: string; entrypoint?: string; service: string }>[];
  }> = {},
): ((env: Readonly<ConfigEnv>) => UserConfig) => {
  const appRoot = paths.join(repositoryRoot, "apps", app);
  const realtime = grants(app, "realtime");
  return ({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
    build: { sourcemap: "hidden" },
    plugins: [
      lazyPlugins(() => [
        failOnBrokenSourceMaps(),
        scalarReference(),
        previewDevVars(appRoot),
        privateSourceMaps(app),
        devBoundary(app),
        elysiaAot(appRoot),
        elysiaWorkerdJit(),
        cloudflare({
          auxiliaryWorkers: [coreDevWorker],
          config: (config) => ({
            ...config,
            assets: {
              binding: "ASSETS",
              run_worker_first: command !== "serve" || isPreview === true,
            },
            compatibility_date: workerCompatibility.date,
            compatibility_flags: [...workerCompatibility.flags],
            d1_databases: [localDatabase],
            ...(realtime
              ? {
                  durable_objects: {
                    bindings: [localUserInbox],
                  },
                  migrations: [{ new_sqlite_classes: [userInboxClassName], tag: "v1" }],
                }
              : {}),
            main: "./src/app/server.ts",
            name: devWorkerName(app),
            services: [
              ...(config.services ?? []),
              {
                binding: "CORE",
                entrypoint: coreEntrypoints[app],
                service: coreDevWorkerName,
              },
              ...services,
            ],
            ...(grants(app, "jobs")
              ? {
                  queues: {
                    consumers: [{ queue: jobsQueueName }],
                    producers: [{ binding: jobsQueueBinding, queue: jobsQueueName }],
                  },
                  workflows: [
                    {
                      binding: jobsWorkflowBinding,
                      class_name: jobsWorkflowClass,
                      name: jobsWorkflowName,
                    },
                  ],
                }
              : {}),
            ...(grants(app, "storage")
              ? { kv_namespaces: [localCacheNamespace], r2_buckets: [localFileBucket] }
              : {}),
          }),
          inspectorPort: false,
          persistState: { path: localDatabaseDirectory() },
          viteEnvironment: { name: "ssr" },
        }),
        ...plugins,
        tailwindcss(),
        ...withoutEnvFileLoader(tanstackStart(startOptions)),
        reactCompiler(),
      ]),
    ],
    preview: appServer(app),
    server: appServer(app),
  });
};

const wikiStartOptions = {
  ...startOptions,
  router: { ...startOptions.router, basepath: "/" },
  serverFns: { base: wikiServerFnBase },
};

const wikiContentInput = {
  base: "workspace",
  pattern: `apps/${wikiHost}/content/docs/**`,
} as const;

const wikiTasks = measured({
  ...checkCode,
  ...workspaceCheckImports,
  ...appChecks,
  ...sliceBoundaries,
  build: {
    ...appTasks.build,
    input: [...appTasks.build.input, wikiContentInput],
  },
  dev: appTasks.dev,
  preview: appTasks.preview,
  ...lifecycle({
    precommit: ["check:code"],
    prepush: appPrepush,
    prepr: ["build"],
    premerge: ["build"],
  }),
} satisfies Tasks);

const wikiRun = (packageRoot: string): RunConfig => ({
  tasks: { ...effectDiagnostics(packageRoot), ...wikiTasks },
});

const wikiServer: ServerOptions = {
  host: loopbackAddress,
  port: wikiPort,
  strictPort: true,
  ws: { path: wikiHmrPath },
};

const wikiConfig = (
  plugins: readonly PluginOption[] = [],
): ((env: Readonly<ConfigEnv>) => UserConfig) => {
  const wikiRoot = paths.join(repositoryRoot, "apps", wikiWorker);
  return ({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
    base: `${wikiBasePath}/`,
    build: { sourcemap: "hidden" },
    plugins: [
      lazyPlugins(() => [
        failOnBrokenSourceMaps(),
        privateSourceMaps(wikiWorker),
        devBoundary(wikiWorker),
        elysiaAot(wikiRoot),
        elysiaWorkerdJit(),
        cloudflare({
          config: (config) => ({
            ...config,
            assets: {
              binding: "ASSETS",
              run_worker_first: command !== "serve" || isPreview === true,
            },
            compatibility_date: workerCompatibility.date,
            compatibility_flags: [...workerCompatibility.flags],
            main: "./src/app/server.ts",
            name: wikiDevWorkerName,
            vars: { ...config.vars, APP_RELEASE: "local" },
          }),
          inspectorPort: false,
          viteEnvironment: { name: "ssr" },
        }),
        ...plugins,
        tailwindcss(),
        ...withoutEnvFileLoader(tanstackStart(wikiStartOptions)),
        reactCompiler(),
      ]),
    ],
    preview: wikiServer,
    run: wikiRun(wikiRoot),
    server: wikiServer,
  });
};

export {
  appConfig,
  wikiConfig,
  appRun,
  elysiaWorkerdJit,
  appServer,
  awaitingEffectDiagnostics,
  awaitingEffectRun,
  checkCode,
  clientReachableModules,
  defineConfig,
  effectDiagnostics,
  effectRun,
  effectTsgoNoEmit,
  intentValidation,
  lifecycle,
  lifecycleInherits,
  lifecycles,
  modularBoundaries,
  paraglideAppRun,
  previewDevVars,
  workspaceParaglideCompile,
  reactCompiler,
  serverOnlyMarkers,
  serverOnlyPackages,
  generatedDirectories,
  sliceBoundaries,
  startOptions,
  measured,
  taskInput,
  telemetryEnv,
  testRun,
  toolTest,
  wikiCompanion,
  wikiDevServices,
  withoutEnvFileLoader,
  workspaceCheckImports,
};
export { paths } from "./host.ts";
export { paraglideAppPlugin, paraglideCompileOptions, paraglideStrategy } from "./paraglide.ts";
export { runTypecheckGate } from "./effect-typecheck.ts";
export { devBoundary, failOnBrokenSourceMaps, privateSourceMaps, type RunConfig, type Tasks };
