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
import { Effect } from "effect";
import {
  defineConfig,
  lazyPlugins,
  type ConfigEnv,
  type Plugin,
  type PluginOption,
  type ServerOptions,
  type UserConfig,
} from "vite-plus";

import { devBoundary } from "./dev-boundary.ts";
import { elysiaAot, elysiaWorkerdJit } from "./elysia-aot.ts";
import { filesystem, isNotFound, paths } from "./host.ts";
import { failOnBrokenSourceMaps, privateSourceMaps } from "./private-source-maps.ts";

const readDevVars = (appRoot: string): Effect.Effect<string | undefined> =>
  filesystem.readFileString(paths.join(appRoot, ".dev.vars")).pipe(
    Effect.catchIf(isNotFound, () => Effect.as(Effect.void, undefined as string | undefined)),
    Effect.orDie,
  );

const previewDevVars = (appRoot: string): Plugin => {
  return {
    apply: "build",
    applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "ssr",
    generateBundle() {
      const emitDevVarsFile = (
        file: Readonly<{ fileName: string; source: string; type: "asset" }>,
      ): void => {
        this.emitFile(file);
      };
      const reportMissingDevVars = (missingDevVarsText: string): void => {
        this.error(missingDevVarsText);
      };
      return Effect.runPromise(
        Effect.gen(function* emitDevVars() {
          const source = yield* readDevVars(appRoot);
          if (source === undefined) {
            reportMissingDevVars(
              `Missing ${paths.join(appRoot, ".dev.vars")}; run vp run --filter @repo/dev setup before building for preview`,
            );
            return;
          }
          emitDevVarsFile({ fileName: ".dev.vars", source, type: "asset" });
        }),
      );
    },
    name: "template-preview-dev-vars",
  };
};

const clientReachableModules = [
  "libs/runtime/src/client.ts",
  "libs/runtime/src/contracts.ts",
  "libs/runtime/src/security.ts",
] as const;
const serverOnlyPackages = ["auth", "db", "runtime"] as const;
const serverOnlyFiles: (string | RegExp)[] = [
  ...serverOnlyPackages.map((packageDirectory) => `**/libs/${packageDirectory}/src/**`),
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

const pluginNamed = (plugin: PluginOption): string | undefined =>
  typeof plugin === "object" &&
  plugin !== null &&
  "name" in plugin &&
  typeof plugin.name === "string"
    ? plugin.name
    : undefined;

const stripEnvFileLoader = (
  pluginOptions: readonly PluginOption[],
): readonly [PluginOption[], number] => {
  const pieces = pluginOptions.map((plugin): readonly [PluginOption[], number] => {
    if (Array.isArray(plugin)) {
      const [nested, removedCount] = stripEnvFileLoader(plugin);
      return [[...nested], removedCount];
    }
    return pluginNamed(plugin) === envFileLoader ? [[], 1] : [[plugin], 0];
  });
  return [
    pieces.flatMap(([kept]) => kept),
    pieces.reduce((removedSum, [, removedCount]) => removedSum + removedCount, 0),
  ];
};

const withoutEnvFileLoader = (plugins: readonly PluginOption[]): PluginOption[] => {
  const [kept, removed] = stripEnvFileLoader(plugins);
  if (removed === 0) {
    return Effect.runSync(Effect.die(`${envFileLoader} plugin not found`));
  }
  return [...kept];
};

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

const taskInput = [
  { auto: true },
  { base: "workspace", pattern: "!node_modules/.modules.yaml" },
  { base: "workspace", pattern: "!**/node_modules/.bin/**" },
] as const;

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

const typecheckInputs = [
  ...taskInput,
  { base: "workspace", pattern: "**/*.{ts,tsx}" },
  { base: "workspace", pattern: "**/package.json" },
  { base: "workspace", pattern: "**/tsconfig*.json" },
  { base: "workspace", pattern: "!**/node_modules/**" },
  { base: "workspace", pattern: "!**/dist/**" },
  { base: "workspace", pattern: "!**/.paraglide/**" },
  { base: "workspace", pattern: "!**/.local/**" },
] as const;

const effectDiagnostics = {
  "check:effect": {
    command: '"$(effect-tsgo get-exe-path)" --pretty false --noEmit -p tsconfig.json',
    input: [...typecheckInputs],
  },
} satisfies NonNullable<UserConfig["run"]>["tasks"];

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

const lifecycle = (
  stages: Readonly<Partial<Record<Lifecycle, readonly string[]>>> = {},
): {
  readonly precommit: LifecycleTask;
  readonly prepush: LifecycleTask;
  readonly prepr: LifecycleTask;
  readonly premerge: LifecycleTask;
  readonly prerelease: LifecycleTask;
} => ({
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
});

const effectRun = {
  tasks: {
    ...effectDiagnostics,
    ...lifecycle({ prepush: ["check:effect"] }),
  },
} satisfies RunConfig;

const appRun = {
  tasks: {
    ...effectDiagnostics,
    check: sliceBoundaries.check,
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
    },
    dev: { cache: false, command: "vp dev" },
    preview: { cache: false, command: "vp preview" },
    ...lifecycle({
      prepush: ["check:effect", "check"],
      prepr: ["build"],
      premerge: ["build", "check:dev"],
    }),
  },
} satisfies RunConfig;

const workspaceParaglideCompile = {
  command: "./libs/vite-config/src/compile-workspace-paraglide.ts",
  input: [
    ...taskInput,
    { base: "workspace", pattern: "apps/*/messages/**" },
    { base: "workspace", pattern: "apps/*/project.inlang/**" },
    { base: "workspace", pattern: "libs/vite-config/src/paraglide-options.ts" },
    { base: "workspace", pattern: "libs/vite-config/src/compile-paraglide.ts" },
    { base: "workspace", pattern: "libs/vite-config/src/compile-workspace-paraglide.ts" },
  ],
  output: [{ base: "workspace", pattern: "apps/*/.paraglide/**" }],
} satisfies NonNullable<Tasks[string]>;

const paraglideCompileInputs = [
  ...taskInput,
  "messages/**",
  "project.inlang/**",
  { base: "workspace", pattern: "libs/vite-config/src/paraglide-options.ts" },
  { base: "workspace", pattern: "libs/vite-config/src/compile-paraglide.ts" },
] as const;

const paraglideAppRun = {
  tasks: {
    ...appRun.tasks,
    "compile:paraglide": {
      command: "../../libs/vite-config/src/compile-paraglide.ts",
      input: [...paraglideCompileInputs],
      output: [".paraglide/**"],
    },
    "check:effect": {
      ...effectDiagnostics["check:effect"],
      dependsOn: ["compile:paraglide"],
    },
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
    main: paths.join(repositoryRoot, "apps/core/src/worker.ts"),
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

export {
  appConfig,
  appRun,
  elysiaWorkerdJit,
  appServer,
  clientReachableModules,
  defineConfig,
  effectDiagnostics,
  effectRun,
  intentValidation,
  lifecycle,
  lifecycleInherits,
  lifecycles,
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
};
export { paths } from "./host.ts";
export { paraglideAppPlugin, paraglideCompileOptions, paraglideStrategy } from "./paraglide.ts";
export { failOnBrokenSourceMaps, privateSourceMaps };
export type { Tasks };
export { devBoundary };
