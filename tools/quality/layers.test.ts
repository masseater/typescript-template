import { describe, expect, it } from "vite-plus/test";
import type { ViteUserConfigFnObject } from "vite-plus";
import { appRun } from "@template/config/vite";
import { applications } from "@template/config";
import { reported } from "./lint-harness.ts";

const source = "export const value = 1;\n";

const appConfigs: Readonly<Record<string, ViteUserConfigFnObject>> =
  import.meta.glob<ViteUserConfigFnObject>("../../apps/*/vite.config.ts", {
    eager: true,
    import: "default",
  });

const steigerConfigs: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../apps/*/steiger.config.ts",
  { eager: true, import: "default" },
);

function appName(key: string): string {
  return /\/apps\/(?<app>[^/]+)\//u.exec(key)?.groups?.["app"] ?? "";
}

describe("steiger coverage", () => {
  it("runs the shared layer check in every application", () => {
    expect.hasAssertions();
    expect(
      Object.keys(appConfigs)
        .map((key) => appName(key))
        .toSorted(),
    ).toStrictEqual(applications.toSorted());
    for (const config of Object.values(appConfigs)) {
      expect(config({ command: "build", mode: "production" }).run).toBe(appRun);
    }
  });

  it("gives every application its own steiger config", () => {
    expect.hasAssertions();
    expect(
      Object.keys(steigerConfigs)
        .map((key) => appName(key))
        .toSorted(),
    ).toStrictEqual(applications.toSorted());
  });
});

describe("feature-sliced layers", () => {
  it.for([
    "apps/user/src/components/legacy.ts",
    "apps/user/src/loose.ts",
    "apps/admin/src/components/users-page.tsx",
    "apps/admin/src/users-search.ts",
    "apps/wiki/src/lib/source.ts",
    "apps/wiki/src/start.ts",
  ])("rejects %s outside the layers", (name) => {
    expect.hasAssertions();
    expect(reported("layers", name, source)).toBe(true);
  });

  it.for([
    "apps/user/src/app/server.ts",
    "apps/user/src/pages/profile/index.ts",
    "apps/user/vite.config.ts",
    "apps/admin/src/pages/users/ui/users-page.tsx",
    "apps/wiki/src/shared/content/source.ts",
  ])("allows %s", (name) => {
    expect.hasAssertions();
    expect(reported("layers", name, source)).toBe(false);
  });
});
