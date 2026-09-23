import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, type PlatformError } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { directoryEntries } from "../platform/directory-entries.ts";
import { repositoryRoot } from "./repository-root.ts";
import { commands } from "./tasks.ts";
import {
  isolatedNodeTestSuffix,
  isolatedNodeTests,
  prCheckShardCount,
  unitTestShardCount,
} from "./test-runtime.ts";

type TreeScan<Scanned> = Effect.Effect<
  Scanned,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
>;

const repositoryText = (file: string): TreeScan<string> =>
  Effect.gen(function* repositoryText() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    return yield* filesystem.readFileString(paths.join(repositoryRoot, file));
  });

const [workflow, vite] = await Effect.runPromise(
  Effect.all([
    repositoryText(".github/workflows/check.yml"),
    repositoryText("vite.config.ts"),
  ]).pipe(Effect.provide(NodeServices.layer)),
);

const fakeTimerCall = /\b(?:vi|jest)\.useFakeTimers\b|\bsetSystemTime\b/u;
const moduleMockCall = /^(?:await\s+)?vi\.(?:mock|doMock)\(/mu;

const collectTestFiles = (directory: string): TreeScan<string[]> =>
  Effect.gen(function* scanTestFiles() {
    const paths = yield* Path.Path;
    const entries = yield* directoryEntries(directory);
    const found = yield* Effect.forEach(entries, (entry): TreeScan<string[]> => {
      const next = paths.join(directory, entry.name);
      if (entry.kind === "directory") {
        return entry.name === "node_modules" || entry.name === "dist"
          ? Effect.succeed([])
          : collectTestFiles(next);
      }
      return Effect.succeed(
        /\.test\.tsx?$/u.test(entry.name) && !entry.name.includes(".worker.test.") ? [next] : [],
      );
    });
    return found.flat();
  });

const offendingTestFiles = (
  roots: readonly string[],
  offends: (file: string) => boolean,
  matches: RegExp,
): TreeScan<string[]> =>
  Effect.gen(function* offendingTestFiles() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const found = yield* Effect.forEach(roots, (root) =>
      collectTestFiles(paths.join(repositoryRoot, root)),
    );
    const candidates = found.flat().filter(offends);
    const offenders = yield* Effect.filter(candidates, (file) =>
      Effect.map(filesystem.readFileString(file), (source) => matches.test(source)),
    );
    return offenders.map((file) => paths.relative(repositoryRoot, file)).toSorted();
  });

describe("vitest isolation and sharding", () => {
  it("shares the node module graph and keeps an isolated opt-out project", () => {
    expect.hasAssertions();
    expect(vite).toContain("isolate: false");
    expect(vite).toContain('name: "node"');
    expect(vite).toContain('name: "node-isolated"');
    expect(vite).toContain("isolatedNodeTests");
    expect(isolatedNodeTests).toContain(isolatedNodeTestSuffix);
  });

  it("runs one pull request check shard per matrix entry", () => {
    expect.hasAssertions();
    const shards = Array.from({ length: prCheckShardCount }, (_unused, index) => index + 1);
    expect(workflow).toMatch(
      new RegExp(
        String.raw`^ {2}check-shard:\n(?: {4}.+\n)* {8}shard: \[${shards.join(", ")}\]\n`,
        "mu",
      ),
    );
    expect(workflow).toContain("CHECK_SHARD: ${{ matrix.shard }}");
  });

  it("shards the merge-queue unit suite without repeating package premerge", () => {
    expect.hasAssertions();
    expect(unitTestShardCount).toBe(4);
    expect(workflow).toContain("shard: [1, 2, 3, 4]");
    expect(workflow).toContain(`--shard=\${{ matrix.shard }}/${String(unitTestShardCount)}`);
    expect(workflow).toContain("merge-queue-packages:");
    expect(workflow).toContain("merge-queue-unit:");
    expect(workflow).toMatch(
      /merge-queue:\n(?: {4}.+\n)* {4}needs: \[merge-queue-packages, merge-queue-unit\]/u,
    );
  });

  it("keeps fake timers out of the shared node project", () =>
    Effect.runPromise(
      Effect.gen(function* fakeTimersKeptOut() {
        expect.hasAssertions();
        const paths = yield* Path.Path;
        const offenders = yield* offendingTestFiles(
          ["apps", "libs", "infra", "tools"],
          (file) =>
            !file.endsWith(isolatedNodeTestSuffix) &&
            !file.includes(`${paths.sep}specs${paths.sep}`),
          fakeTimerCall,
        );
        expect(offenders).toStrictEqual([]);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("runs dont-review-it on a shared module graph and its isolated opt-outs apart", () => {
    expect.hasAssertions();
    expect(commands("tools/dont-review-it", "test")).toStrictEqual([
      `vp test run --isolate=false --exclude '${isolatedNodeTests}'`,
      `vp test run ${isolatedNodeTestSuffix}`,
    ]);
  });

  it("keeps module mocks out of the shared module graph", () =>
    Effect.runPromise(
      Effect.gen(function* moduleMocksKeptOut() {
        expect.hasAssertions();
        const offenders = yield* offendingTestFiles(
          ["apps", "libs", "infra", "tools/dont-review-it"],
          (file) => !file.endsWith(isolatedNodeTestSuffix) && !file.includes(".dev-server.test."),
          moduleMockCall,
        );
        expect(offenders).toStrictEqual([]);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));
});
