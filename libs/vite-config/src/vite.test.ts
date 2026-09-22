import { applications, type Application } from "@repo/config";
import { describe, expect, test } from "vite-plus/test";

import {
  appConfig,
  appRun,
  effectDiagnostics,
  effectRun,
  lifecycle,
  sliceBoundaries,
  taskInput,
} from "./vite.ts";

import type { ConfigEnv, PluginOption } from "vite-plus";

const serve = { command: "serve", isPreview: false, mode: "test" } as const satisfies ConfigEnv;

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

describe("effectRun", () => {
  const it = test.extend("effectWorkspaceRun", () => effectRun);

  it("keeps the effect workspace on typecheck before push", ({ effectWorkspaceRun }) => {
    expect(effectWorkspaceRun).toStrictEqual({
      tasks: {
        ...effectDiagnostics,
        ...lifecycle({ prepush: ["check:effect"] }),
      },
    });
  });
});

describe("appRun", () => {
  const it = test.extend("applicationRun", () => appRun);

  it("type-checks, builds, and starts before the stages that ship an app", ({ applicationRun }) => {
    expect(applicationRun).toStrictEqual({
      tasks: {
        ...effectDiagnostics,
        check: sliceBoundaries.check,
        build: {
          command: "vp build",
          dependsOn: ["@repo/dev#setup", "check:effect"],
          input: [
            ...taskInput,
            "!.wrangler",
            "!.wrangler/**",
            "!dist",
            "!dist/**",
            { base: "workspace", pattern: "!.local" },
            { base: "workspace", pattern: "!.local/**" },
          ],
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
      const withMarker = pluginNamesOf(appConfig("service-admin", [marker])(serve).plugins ?? []);
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
