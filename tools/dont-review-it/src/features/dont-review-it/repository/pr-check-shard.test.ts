import { Effect, Exit } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { type WorkspacePackage } from "./pr-affected-scope.ts";
import { shardOutput } from "./pr-check-shard.ts";
import { prCheckRootShard, prCheckShardCount } from "./test-runtime.ts";

const packages: readonly WorkspacePackage[] = [
  { dependencies: [], directory: "libs/ui", name: "@repo/ui" },
  { dependencies: ["@repo/ui"], directory: "apps/service-member", name: "@repo/service-member" },
  { dependencies: [], directory: "libs/cli", name: "@repo/cli" },
  { dependencies: [], directory: "tools/dev", name: "@repo/dev" },
  { dependencies: [], directory: "infra/github", name: "@repo/infra-github" },
];

const numberedShards = Array.from({ length: prCheckShardCount }, (_unused, index) =>
  String(index + 1),
);

const outputs = (checkShard: string, files: readonly string[]) =>
  Object.fromEntries(
    Effect.runSync(shardOutput(checkShard, files, packages))
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => {
        const [key = "", ...value] = line.split("=");
        return [key, value.join("=")];
      }),
  );

describe("pull request check shard outputs", () => {
  it("gives the root prepr its own shard with no workspace checks", () => {
    expect.hasAssertions();
    for (const files of [["vite.config.ts"], ["libs/ui/src/features/ui/button.tsx"], []]) {
      expect(outputs(prCheckRootShard, files)).toStrictEqual({
        filters: "",
        paths: "",
        root: "true",
      });
    }
  });

  it("splits every workspace across the numbered shards without the root prepr", () => {
    expect.hasAssertions();
    const shards = numberedShards.map((shard) => outputs(shard, ["vite.config.ts"]));
    expect(shards.map((shard) => shard.root)).toStrictEqual(numberedShards.map(() => "false"));
    expect(
      shards
        .flatMap((shard) => (shard.filters ?? "").split(" "))
        .filter((word) => word !== "" && word !== "--filter")
        .toSorted(),
    ).toStrictEqual(packages.map((workspace) => workspace.name).toSorted());
  });

  it("limits the numbered shards to the affected workspaces and their tests", () => {
    expect.hasAssertions();
    const shards = numberedShards.map((shard) =>
      outputs(shard, ["libs/ui/src/features/ui/button.tsx"]),
    );
    expect(
      shards
        .flatMap((shard) => (shard.paths ?? "").split(" "))
        .filter(Boolean)
        .toSorted(),
    ).toStrictEqual(["apps/service-member", "libs/ui"]);
  });

  it("refuses a workspace whose name cannot be a filter", () => {
    expect.hasAssertions();
    const exit = Effect.runSyncExit(
      shardOutput(
        "1",
        ["vite.config.ts"],
        [{ dependencies: [], directory: "apps/service-member", name: "service-member" }],
      ),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });
});
