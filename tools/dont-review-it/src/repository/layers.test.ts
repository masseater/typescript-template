import { applications } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness.ts";
import { commands } from "./tasks.ts";

const source = "export const value = 1;\n";

describe("steiger coverage", () => {
  it("runs the layer check in every application", () => {
    expect.hasAssertions();
    const checks = applications
      .map((app) => `apps/${app}: ${commands(`apps/${app}`, "check").join(" ")}`)
      .toSorted();
    expect(checks).toStrictEqual(
      applications
        .map(
          (app) =>
            `apps/${app}: steiger src --fail-on-warnings && quality-check-thin-app-routes`,
        )
        .toSorted(),
    );
  });
});

describe("feature-sliced layers", () => {
  it.for([
    "apps/service-member/src/components/legacy.ts",
    "apps/service-member/src/loose.ts",
    "apps/service-admin/src/components/users-page.tsx",
    "apps/service-admin/src/users-search.ts",
    "apps/internal-dashboard/src/lib/source.ts",
    "apps/internal-dashboard/src/start.ts",
  ])("rejects %s outside the layers", (name) => {
    expect.hasAssertions();
    expect(reported("layers", { code: source, filename: name })).toBe(true);
  });

  it.for([
    "apps/service-member/src/app/server.ts",
    "apps/service-member/src/pages/profile/index.ts",
    "apps/service-member/vite.config.ts",
    "apps/service-admin/src/pages/users/ui/users-page.tsx",
    "apps/internal-dashboard/src/shared/content/source.ts",
  ])("allows %s", (name) => {
    expect.hasAssertions();
    expect(reported("layers", { code: source, filename: name })).toBe(false);
  });
});
