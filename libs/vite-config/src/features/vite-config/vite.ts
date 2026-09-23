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
import { awaitingEffectDiagnostics, effectDiagnostics, effectTsgoNoEmit } from "./effect-tsgo.ts";
import { elysiaAot, elysiaWorkerdJit } from "./elysia-aot.ts";
import { withoutEnvFileLoader } from "./env-file-loader.ts";
import { paths } from "./host.ts";
import { lifecycle, lifecycleInherits, lifecycles } from "./lifecycle.ts";
import { withoutInlangState, workspaceParaglideCompile } from "./paraglide.ts";
import { previewDevVars } from "./preview-dev-vars.ts";
import { failOnBrokenSourceMaps, privateSourceMaps } from "./private-source-maps.ts";
import { taskInput } from "./task-input.ts";
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
  check: {
    command: "steiger src --fail-on-warnings && quality-check-thin-app-routes",
    input: [...taskInput],
  },
} satisfies Tasks;

const intentValidation = {
  check: { command: "intent validate", input: [...taskInput] },
} satisfies Tasks;

const checkCode = {
  "check:code": { command: "vp check --no-error-on-unmatched-pattern", input: [...taskInput] },
} satisfies Tasks;

const workspaceCheckImports = {
  "check:imports": { command: "quality-check-imports", input: [...taskInput] },
} satisfies Tasks;

const modularBoundaries = {
  "check:modular": { command: "quality-check-modular", input: [...taskInput] },
} satisfies Tasks;

const effectRun = {
  tasks: {
    ...effectDiagnostics,
    ...checkCode,
    ...workspaceCheckImports,
    ...modularBoundaries,
    ...lifecycle({
      precommit: ["check:code"],
      prepush: ["check:effect", "check:imports", "check:modular"],
    }),
  },
} satisfies RunConfig;

const awaitingEffectRun = {
  tasks: {
    ...effectRun.tasks,
    ...awaitingEffectDiagnostics,
  },
} satisfies RunConfig;

const appChecks = {
  "check:client": {
    command: "quality-check-client",
    input: [
      ...taskInput,
      "!**/dist/**",
      "!**/node_modules/.cache/**",
      ...withoutLocalState,
      ...withoutInlangState,
    ],
    output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
  },
  "check:react": {
    command: "quality-check-react",
    input: [...taskInput, "!**/node_modules/.cache/**", "!**/dist/**", ...withoutInlangState],
    output: [{ auto: true }, "!**/node_modules/.cache/**"],
  },
} satisfies Tasks;

const appRun = {
  tasks: {
    ...awaitingEffectDiagnostics,
    ...checkCode,
    ...workspaceCheckImports,
    ...appChecks,
    check: sliceBoundaries.check,
    build: {
      command: "vp build",
      dependsOn: ["@repo/dev#setup", "check:effect"],
      input: [
        ...taskInput,
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
      prepush: ["check:effect", "check", "check:imports", "check:client", "check:react"],
      prepr: ["build"],
      premerge: ["build", "check:dev"],
    }),
  },
} satisfies RunConfig;

const paraglideAppRun = {
  tasks: {
    ...appRun.tasks,
    ...Object.fromEntries(
      (["check:effect", "check:code", "check:imports", "check:client", "check:react"] as const).map(
        (gatedTask) => [
          gatedTask,
          { ...appRun.tasks[gatedTask], dependsOn: ["typescript-template#compile:paraglide"] },
        ],
      ),
    ),
  },
} satisfies RunConfig;

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

const coreDevWorker = {
  config: {
    compatibility_date: workerCompatibility.date,
    compatibility_flags: [...workerCompatibility.flags],
    d1_databases: [localDatabase],
    main: paths.join(repositoryRoot, "apps/core/src/features/core/worker.ts"),
    name: "template-core",
  },
};

const appConfig = (
  app: Application,
  plugins: readonly PluginOption[] = noExtraPlugins,
): ((env: Readonly<ConfigEnv>) => UserConfig) => {
  const appRoot = paths.join(repositoryRoot, "apps", app);
  const realtime = grants(app, "realtime");
  return ({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
    build: { sourcemap: "hidden" },
    plugins: [
      lazyPlugins(() => [
        failOnBrokenSourceMaps(),
        previewDevVars(appRoot),
        privateSourceMaps(app),
        devBoundary(app),
        ...(app === wikiHost
          ? [
              wikiCompanion({
                repositoryRoot,
                wikiRoot: paths.join(repositoryRoot, "apps", wikiWorker),
              }),
            ]
          : []),
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
            name: `template-${app}`,
            services: [
              ...(config.services ?? []),
              {
                binding: "CORE",
                entrypoint: coreEntrypoints[app],
                service: "template-core",
              },
              ...(app === wikiHost ? wikiDevServices : []),
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
    run: appRun,
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

const wikiRun = {
  tasks: {
    ...effectDiagnostics,
    ...checkCode,
    ...workspaceCheckImports,
    ...appChecks,
    check: sliceBoundaries.check,
    build: {
      ...appRun.tasks.build,
      input: [...appRun.tasks.build.input, wikiContentInput],
    },
    dev: appRun.tasks.dev,
    preview: appRun.tasks.preview,
    ...lifecycle({
      precommit: ["check:code"],
      prepush: ["check:effect", "check", "check:imports", "check:client", "check:react"],
      prepr: ["build"],
      premerge: ["build"],
    }),
  },
} satisfies RunConfig;

const WIKI_PORT = 3004;

const wikiServer: ServerOptions = {
  host: loopbackAddress,
  port: WIKI_PORT,
  strictPort: true,
  ws: { path: wikiHmrPath },
};

const wikiConfig = (
  plugins: readonly PluginOption[] = noExtraPlugins,
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
    run: wikiRun,
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
  taskInput,
  testRun,
  toolTest,
  withoutEnvFileLoader,
  workspaceCheckImports,
};
export { paths } from "./host.ts";
export { paraglideAppPlugin, paraglideCompileOptions, paraglideStrategy } from "./paraglide.ts";
export { failOnBrokenSourceMaps, privateSourceMaps };
export { runTypecheckGate } from "./effect-typecheck.ts";
export type { Tasks };
export { devBoundary };
