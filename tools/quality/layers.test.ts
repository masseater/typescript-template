import { describe, expect, it } from "vite-plus/test";
import type { UserConfig } from "vite-plus";
import { layeredApps } from "./layers.ts";
import { reported } from "./lint-harness.ts";

const rootConfig: Readonly<Record<string, Readonly<UserConfig>>> = import.meta.glob(
  "../../vite.config.ts",
  { eager: true, import: "default" },
);

const source = "export const value = 1;\n";

describe("feature-sliced layers", () => {
  it.for(["apps/user/src/components/legacy.ts", "apps/user/src/loose.ts"])(
    "rejects %s outside the layers",
    (name) => {
      expect.hasAssertions();
      expect(reported("layers", name, source)).toBe(true);
    },
  );

  it.for([
    "apps/user/src/app/server.ts",
    "apps/user/src/pages/profile/index.ts",
    "apps/user/vite.config.ts",
    "apps/admin/src/components/users-page.tsx",
  ])("allows %s", (name) => {
    expect.hasAssertions();
    expect(reported("layers", name, source)).toBe(false);
  });

  it("runs steiger on every app the lint rule treats as layered", () => {
    expect.hasAssertions();
    expect([rootConfig["../../vite.config.ts"]?.run?.tasks?.["check:layers"]].flat()).toStrictEqual(
      layeredApps.map((app) => `steiger apps/${app}/src --fail-on-warnings`),
    );
  });
});
