import { applications, type Application } from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";
import { describe, expect, test } from "vite-plus/test";

import { paths } from "./host.ts";
import { localizedApps } from "./paraglide-options.ts";
import {
  appConfig,
  appRun,
  awaitingEffectDiagnostics,
  checkCode,
  effectDiagnostics,
  effectRun,
  lifecycle,
  modularBoundaries,
  paraglideAppRun,
  sliceBoundaries,
  taskInput,
  telemetryEnv,
  workspaceCheckImports,
  workspaceParaglideCompile,
} from "./vite.ts";

import type { ConfigEnv, PluginOption } from "vite-plus";

const serve = { command: "serve", isPreview: false, mode: "test" } as const satisfies ConfigEnv;

const inlangState = [
  "!project.inlang/.gitignore",
  "!project.inlang/.meta.json",
  "!project.inlang/README.md",
  "!project.inlang/cache",
  "!project.inlang/cache/**",
  "!project.inlang/.lix",
  "!project.inlang/.lix/**",
];

describe("lifecycle", () => {
  const it = test
    .extend("inheritedLifecycle", () => lifecycle({ prepush: ["check:effect"] }))
    .extend("declaredLifecycle", () =>
      lifecycle({ precommit: ["check:staged"], prerelease: ["verify:account"] }),
    );

  it("fills omitted stages with inherited gates only", ({ inheritedLifecycle }) => {
    expect(inheritedLifecycle).toStrictEqual({
      precommit: { command: [], dependsOn: [] },
      prepush: { command: [], dependsOn: ["precommit", "check:effect"] },
      prepr: { command: [], dependsOn: ["prepush"] },
      premerge: { command: [], dependsOn: [] },
      prerelease: { command: [], dependsOn: ["prepr", "premerge"] },
    });
  });

  it("keeps commit and release checks on the stages that declare them", ({ declaredLifecycle }) => {
    expect(declaredLifecycle).toStrictEqual({
      precommit: { command: [], dependsOn: ["check:staged"] },
      prepush: { command: [], dependsOn: ["precommit"] },
      prepr: { command: [], dependsOn: ["prepush"] },
      premerge: { command: [], dependsOn: [] },
      prerelease: { command: [], dependsOn: ["prepr", "premerge", "verify:account"] },
    });
  });
});

const libraryRoot = paths.join(repositoryRoot, "libs/config");
const applicationRoot = paths.join(repositoryRoot, "apps/service-admin");

describe("effectRun", () => {
  const it = test.extend("effectWorkspaceRun", () => effectRun(libraryRoot));

  it("lints the workspace before commit and checks types, imports and budgets before push", ({
    effectWorkspaceRun,
  }) => {
    expect(effectWorkspaceRun).toStrictEqual({
      tasks: {
        ...effectDiagnostics(libraryRoot),
        ...checkCode,
        ...workspaceCheckImports,
        ...modularBoundaries,
        ...lifecycle({
          precommit: ["check:code"],
          prepush: ["check:effect", "check:imports", "check:modular"],
        }),
      },
    });
  });
});

describe("appRun", () => {
  const it = test.extend("applicationRun", () => appRun(applicationRoot));

  it("type-checks, builds, and starts before the stages that ship an app", ({ applicationRun }) => {
    expect(applicationRun).toStrictEqual({
      tasks: {
        ...awaitingEffectDiagnostics(applicationRoot),
        ...checkCode,
        ...workspaceCheckImports,
        "check:client": {
          command: "dont-review-it-client",
          env: [...telemetryEnv],
          input: [
            ...taskInput,
            "!node_modules",
            "!**/dist/**",
            "!**/node_modules/.cache/**",
            { base: "workspace", pattern: "!.local" },
            { base: "workspace", pattern: "!.local/**" },
            ...inlangState,
          ],
          output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
        },
        "check:react": {
          command: "dont-review-it-react",
          env: [...telemetryEnv],
          input: [...taskInput, "!**/node_modules/.cache/**", "!**/dist/**", ...inlangState],
          output: [{ auto: true }, "!**/node_modules/.cache/**"],
        },
        ...sliceBoundaries,
        build: {
          command: "vp build",
          env: [...telemetryEnv],
          dependsOn: ["@repo/dev#setup", "check:effect"],
          input: [
            ...taskInput,
            "!.",
            "!node_modules",
            "!.wrangler",
            "!.wrangler/**",
            "!dist",
            "!dist/**",
            { base: "workspace", pattern: "!.local" },
            { base: "workspace", pattern: "!.local/**" },
            ...inlangState,
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
          prepush: [
            "check:effect",
            "check:feature-sliced",
            "check:thin-app-routes",
            "check:imports",
            "check:client",
            "check:react",
          ],
          prepr: ["build"],
          premerge: ["build", "check:dev"],
        }),
      },
    });
  });
});

describe("paraglideAppRun", () => {
  const it = test
    .extend("localizedApplicationRun", () => paraglideAppRun(applicationRoot))
    .extend("applicationRun", () => appRun(applicationRoot));

  it("compiles message catalogs before typecheck and the workspace checks", ({
    applicationRun,
    localizedApplicationRun,
  }) => {
    expect(localizedApplicationRun).toStrictEqual({
      tasks: {
        ...applicationRun.tasks,
        "check:effect": {
          ...awaitingEffectDiagnostics(applicationRoot)["check:effect"],
          dependsOn: ["typescript-template#compile:paraglide"],
        },
        "check:code": {
          ...checkCode["check:code"],
          dependsOn: ["typescript-template#compile:paraglide"],
        },
        "check:imports": {
          ...workspaceCheckImports["check:imports"],
          dependsOn: ["typescript-template#compile:paraglide"],
        },
        "check:client": {
          ...applicationRun.tasks["check:client"],
          dependsOn: ["typescript-template#compile:paraglide"],
        },
        "check:react": {
          ...applicationRun.tasks["check:react"],
          dependsOn: ["typescript-template#compile:paraglide"],
        },
      },
    });
  });
});

describe("sliceBoundaries", () => {
  const it = test.extend("sliceChecks", () => sliceBoundaries);

  it("leaves local state and compiled message catalogs out of the slice checks", ({
    sliceChecks,
  }) => {
    expect(sliceChecks).toStrictEqual({
      "check:feature-sliced": {
        command: "dont-review-it-feature-sliced",
        env: [...telemetryEnv],
        input: [
          ...taskInput,
          { base: "workspace", pattern: "!.local" },
          { base: "workspace", pattern: "!.local/**" },
          ...localizedApps.map((app) => ({
            base: "workspace",
            pattern: `!apps/${app}/.paraglide/**`,
          })),
        ],
      },
      "check:thin-app-routes": {
        command: "dont-review-it-thin-app-routes",
        env: [...telemetryEnv],
        input: [
          ...taskInput,
          { base: "workspace", pattern: "!.local" },
          { base: "workspace", pattern: "!.local/**" },
          ...localizedApps.map((app) => ({
            base: "workspace",
            pattern: `!apps/${app}/.paraglide/**`,
          })),
        ],
      },
    });
  });
});

describe("workspaceParaglideCompile", () => {
  const it = test.extend("paraglideCompile", () => workspaceParaglideCompile);

  it("reads each localized application's catalogs and settings, not the listings the build and compile write into", ({
    paraglideCompile,
  }) => {
    expect(paraglideCompile).toStrictEqual({
      command: "./libs/vite-config/src/features/vite-config/compile-workspace-paraglide.ts",
      env: [...telemetryEnv],
      input: [
        ...taskInput,
        ...localizedApps.flatMap((app) =>
          [
            `apps/${app}/messages/**`,
            `apps/${app}/project.inlang/settings.json`,
            `!apps/${app}`,
            `!apps/${app}/project.inlang`,
            `!apps/${app}/.paraglide/**`,
            ...inlangState.map((pattern) => pattern.replace("!", `!apps/${app}/`)),
          ].map((pattern) => ({ base: "workspace", pattern })),
        ),
        {
          base: "workspace",
          pattern: "libs/vite-config/src/features/vite-config/paraglide-options.ts",
        },
        {
          base: "workspace",
          pattern: "libs/vite-config/src/features/vite-config/compile-workspace-paraglide.ts",
        },
      ],
      output: localizedApps.map((app) => ({
        base: "workspace",
        pattern: `apps/${app}/.paraglide/**`,
      })),
    });
  });
});

describe("appConfig", () => {
  const it = test
    .extend("pluginNamesByApplication", () => {
      const pluginNamesOf = (
        plugins: readonly PluginOption[],
        app: Application,
      ): readonly string[] =>
        plugins.flatMap((plugin): readonly string[] => {
          if (Array.isArray(plugin)) {
            return pluginNamesOf(plugin, app);
          }
          if (
            typeof plugin === "object" &&
            plugin !== null &&
            "name" in plugin &&
            typeof plugin.name === "string"
          ) {
            return [plugin.name.replaceAll(`template-${app}-dev-boundary`, "dev-boundary")];
          }
          return [];
        });
      return applications.map((app) => pluginNamesOf(appConfig(app)(serve).plugins ?? [], app));
    })
    .extend("adminPlugins", () => {
      const pluginNamesOf = (plugins: readonly PluginOption[]): readonly string[] =>
        plugins.flatMap((plugin): readonly string[] => {
          if (Array.isArray(plugin)) {
            return pluginNamesOf(plugin);
          }
          if (
            typeof plugin === "object" &&
            plugin !== null &&
            "name" in plugin &&
            typeof plugin.name === "string"
          ) {
            return [plugin.name];
          }
          return [];
        });
      return pluginNamesOf(appConfig("service-admin")(serve).plugins ?? []);
    })
    .extend("adminElysiaAotPlugins", () => {
      const pluginRecordsOf = (
        plugins: readonly PluginOption[],
      ): readonly (readonly [string, unknown])[] =>
        plugins.flatMap((plugin): readonly (readonly [string, unknown])[] => {
          if (Array.isArray(plugin)) {
            return pluginRecordsOf(plugin);
          }
          if (
            typeof plugin === "object" &&
            plugin !== null &&
            "name" in plugin &&
            typeof plugin.name === "string" &&
            plugin.name === "elysia-aot"
          ) {
            return [[plugin.name, "apply" in plugin ? plugin.apply : undefined]];
          }
          return [];
        });
      return pluginRecordsOf(appConfig("service-admin")(serve).plugins ?? []);
    })
    .extend("adminPluginsWithMarker", () => {
      const marker = { name: "app-specific" };
      const pluginNamesOf = (plugins: readonly PluginOption[]): readonly string[] =>
        plugins.flatMap((plugin): readonly string[] => {
          if (Array.isArray(plugin)) {
            return pluginNamesOf(plugin);
          }
          if (
            typeof plugin === "object" &&
            plugin !== null &&
            "name" in plugin &&
            typeof plugin.name === "string"
          ) {
            return [plugin.name];
          }
          return [];
        });
      const withMarker = pluginNamesOf(
        appConfig("service-admin", { plugins: [marker] })(serve).plugins ?? [],
      );
      return withMarker.toSpliced(withMarker.indexOf(marker.name), 1);
    });

  it("gives every application the same plugin wiring", ({ pluginNamesByApplication }) => {
    expect(pluginNamesByApplication).toStrictEqual([
      pluginNamesByApplication[0],
      pluginNamesByApplication[0],
      pluginNamesByApplication[0],
    ]);
  });

  it("inserts application plugins after the dev boundary", ({
    adminPlugins,
    adminPluginsWithMarker,
  }) => {
    expect(adminPluginsWithMarker).toStrictEqual(adminPlugins);
  });

  it("runs Elysia AOT on the admin worker while Vite is serving", ({ adminElysiaAotPlugins }) => {
    expect(adminElysiaAotPlugins).toStrictEqual([["elysia-aot", undefined]]);
  });
});
