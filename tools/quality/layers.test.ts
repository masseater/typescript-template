import { describe, expect, it } from "vite-plus/test";

import { applications } from "@template/config";

import { field, workspaceManifests } from "./dependencies.ts";
import { reported } from "./lint-harness.ts";

const source = "export const value = 1;\n";

describe("steiger coverage", () => {
  it("runs the layer check in every application", () => {
    expect.hasAssertions();
    const checks = workspaceManifests
      .filter(({ area }) => area === "apps")
      .map(({ file, manifest }) => `${file}: ${String(field(field(manifest, "scripts"), "check"))}`)
      .toSorted();
    expect(checks).toStrictEqual(
      applications
        .map((app) => `apps/${app}/package.json: steiger src --fail-on-warnings`)
        .toSorted(),
    );
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
