import { describe, expect, it } from "vite-plus/test";

import { applications } from "./applications.ts";
import { appConfig, appRun, appServer } from "./vite.ts";

import type { ConfigEnv, PluginOption } from "vite-plus";
import type { Application } from "./applications.ts";

const environments = [
  { command: "serve", isPreview: false, mode: "test" },
  { command: "serve", isPreview: true, mode: "test" },
  { command: "build", mode: "test" },
] as const satisfies readonly ConfigEnv[];

function pluginNames(plugins: readonly PluginOption[]): string[] {
  return plugins.flatMap((plugin): string[] => {
    if (Array.isArray(plugin)) {
      return pluginNames(plugin);
    }
    if (typeof plugin === "object" && plugin !== null && "name" in plugin) {
      return typeof plugin.name === "string" ? [plugin.name] : [];
    }
    return [];
  });
}

function withoutIdentity(names: readonly string[], app: Application): string[] {
  return names.map((name) => name.replaceAll(`template-${app}-dev-boundary`, "dev-boundary"));
}

describe("appConfig", () => {
  it("gives every application the same Cloudflare, D1, TanStack, and Tailwind wiring", () => {
    expect.hasAssertions();
    for (const env of environments) {
      const shared = applications.map((app) =>
        withoutIdentity(pluginNames(appConfig(app)(env).plugins ?? []), app),
      );
      expect(new Set(shared.map((names) => names.join("\n"))).size).toBe(1);
      for (const app of applications) {
        const config = appConfig(app)(env);
        expect(config.build).toStrictEqual({ sourcemap: "hidden" });
        expect(config.preview).toStrictEqual(appServer(app));
        expect(config.run).toBe(appRun);
        expect(config.server).toStrictEqual(appServer(app));
      }
    }
    const [serve] = environments;
    const marker = { name: "app-specific" };
    const base = pluginNames(appConfig("service-admin")(serve).plugins ?? []);
    const withMarker = pluginNames(appConfig("service-admin", [marker])(serve).plugins ?? []);
    const at = withMarker.indexOf(marker.name);
    expect(at).toBeGreaterThan(withMarker.indexOf("template-service-admin-dev-boundary"));
    expect(withMarker.toSpliced(at, 1)).toStrictEqual(base);
  });
});
