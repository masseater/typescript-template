import { describe, expect, it } from "vite-plus/test";

import { affectedTests, type WorkspacePackage } from "./pr-affected-scope.ts";

const packages: readonly WorkspacePackage[] = [
  { dependencies: [], directory: "libs/ui", name: "@repo/ui" },
  { dependencies: ["@repo/ui"], directory: "apps/service-member", name: "@repo/service-member" },
  { dependencies: [], directory: "libs/cli", name: "@repo/cli" },
];

describe("affected test directories", () => {
  it("runs the whole suite when the diff is empty or leaves the workspaces", () => {
    expect.hasAssertions();
    expect(affectedTests([], packages)).toStrictEqual({ kind: "all" });
    expect(affectedTests(["vite.config.ts"], packages)).toStrictEqual({ kind: "all" });
    expect(affectedTests([".github/workflows/check.yml"], packages)).toStrictEqual({
      kind: "all",
    });
  });

  it("includes the changed package and the packages that depend on it", () => {
    expect.hasAssertions();
    expect(affectedTests(["libs/ui/src/features/ui/button.tsx"], packages)).toStrictEqual({
      directories: ["apps/service-member", "libs/ui"],
      kind: "subset",
    });
    expect(affectedTests(["libs/cli/src/features/cli/cli.ts"], packages)).toStrictEqual({
      directories: ["libs/cli"],
      kind: "subset",
    });
    expect(
      affectedTests(
        ["libs/ui/src/features/ui/button.tsx"],
        [
          ...packages,
          {
            dependencies: ["@repo/service-member"],
            directory: "apps/service-admin",
            name: "@repo/service-admin",
          },
        ],
      ),
    ).toStrictEqual({
      directories: ["apps/service-admin", "apps/service-member", "libs/ui"],
      kind: "subset",
    });
  });

  it("widens to the whole suite when any changed file is outside a workspace", () => {
    expect.hasAssertions();
    expect(
      affectedTests(["libs/ui/src/features/ui/button.tsx", "vite.config.ts"], packages),
    ).toStrictEqual({
      kind: "all",
    });
    expect(affectedTests(["apps/missing/src/index.ts"], packages)).toStrictEqual({ kind: "all" });
  });
});
