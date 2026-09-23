import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { repositoryRoot } from "./repository-root.ts";
import { commands } from "./tasks.ts";
import {
  isolatedNodeTestSuffix,
  isolatedNodeTests,
  prCheckShardCount,
  unitTestShardCount,
} from "./test-runtime.ts";

const workflow = readFileSync(path.join(repositoryRoot, ".github/workflows/check.yml"), "utf8");
const vite = readFileSync(path.join(repositoryRoot, "vite.config.ts"), "utf8");

const fakeTimerCall = /\b(?:vi|jest)\.useFakeTimers\b|\bsetSystemTime\b/u;
const moduleMockCall = /^(?:await\s+)?vi\.(?:mock|doMock)\(/mu;

function collectTestFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const next = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      found.push(...collectTestFiles(next));
      continue;
    }
    if (/\.test\.tsx?$/u.test(entry.name) && !entry.name.includes(".worker.test.")) {
      found.push(next);
    }
  }
  return found;
}

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

  it("keeps fake timers out of the shared node project", () => {
    expect.hasAssertions();
    const offenders = ["apps", "libs", "infra", "tools"]
      .flatMap((root) => collectTestFiles(path.join(repositoryRoot, root)))
      .filter((file) => !file.endsWith(isolatedNodeTestSuffix))
      .filter((file) => !file.includes(`${path.sep}specs${path.sep}`))
      .filter((file) => fakeTimerCall.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(repositoryRoot, file))
      .toSorted();
    expect(offenders).toStrictEqual([]);
  });

  it("runs dont-review-it on a shared module graph and its isolated opt-outs apart", () => {
    expect.hasAssertions();
    expect(commands("tools/dont-review-it", "test")).toStrictEqual([
      `vp test run --isolate=false --exclude '${isolatedNodeTests}'`,
      `vp test run ${isolatedNodeTestSuffix}`,
    ]);
  });

  it("keeps module mocks out of the shared module graph", () => {
    expect.hasAssertions();
    const offenders = ["apps", "libs", "infra", "tools/dont-review-it"]
      .flatMap((root) => collectTestFiles(path.join(repositoryRoot, root)))
      .filter((file) => !file.endsWith(isolatedNodeTestSuffix))
      .filter((file) => !file.includes(".dev-server.test."))
      .filter((file) => moduleMockCall.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(repositoryRoot, file))
      .toSorted();
    expect(offenders).toStrictEqual([]);
  });
});
