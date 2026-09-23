import { describe, expect, it } from "vite-plus/test";

import { affectedTests, shardDirectories, type WorkspacePackage } from "./pr-affected-scope.ts";
import { workspaceDirectories } from "./tasks.ts";
import { prCheckShardCount } from "./test-runtime.ts";

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

describe("pull request check shards", () => {
  const workspaces = workspaceDirectories.filter((directory) => directory !== ".");
  const shards = Array.from({ length: prCheckShardCount }, (_unused, index) =>
    shardDirectories(workspaces, index + 1, prCheckShardCount),
  );

  it("checks every workspace in exactly one shard", () => {
    expect.hasAssertions();
    expect(shards.flat().toSorted()).toStrictEqual([...workspaces].toSorted());
  });

  it("puts the applications in different shards", () => {
    expect.hasAssertions();
    const applications = workspaces.filter((directory) => directory.startsWith("apps/"));
    expect(
      shards.map((shard) => shard.filter((directory) => directory.startsWith("apps/")).length),
    ).toStrictEqual(
      Array.from(
        { length: prCheckShardCount },
        (_unused, index) => Math.floor((applications.length - index - 1) / prCheckShardCount) + 1,
      ),
    );
  });

  it("refuses a shard the check does not run", () => {
    expect.hasAssertions();
    expect(() => shardDirectories(workspaces, 0, prCheckShardCount)).toThrow("is not a shard");
    expect(() => shardDirectories(workspaces, prCheckShardCount + 1, prCheckShardCount)).toThrow(
      "is not a shard",
    );
  });
});
