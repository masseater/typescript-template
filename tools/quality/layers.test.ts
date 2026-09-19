import { applications } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness.ts";
import { commands } from "./tasks.ts";

const source = "export const value = 1;\n";

describe("steiger coverage", () => {
  it("runs the layer check in every application and commander", () => {
    expect.hasAssertions();
    const checks = applications
      .map((app) => `apps/${app}: ${commands(`apps/${app}`, "check").join(" ")}`)
      .toSorted();
    expect(checks).toStrictEqual(
      applications.map((app) => `apps/${app}: steiger src --fail-on-warnings`).toSorted(),
    );
    expect(commands("tools/commander", "check")).toStrictEqual(["steiger src --fail-on-warnings"]);
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
    expect(reported("layers", { code: source, filename: name })).toBe(true);
  });

  it.for([
    "apps/user/src/app/server.ts",
    "apps/user/src/pages/profile/index.ts",
    "apps/user/vite.config.ts",
    "apps/admin/src/pages/users/ui/users-page.tsx",
    "apps/wiki/src/shared/content/source.ts",
  ])("allows %s", (name) => {
    expect.hasAssertions();
    expect(reported("layers", { code: source, filename: name })).toBe(false);
  });
});
