import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Layer, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect, vi } from "vite-plus/test";

import { gitEnvironmentLayer } from "./git-text.ts";
import { ComparisonUnresolved, resolvedComparison } from "./resolved-comparison.ts";

import type { GitHubRequest } from "./github-comparison.ts";

class GitFixtureRefused extends Schema.TaggedError<GitFixtureRefused>()("GitFixtureRefused", {
  command: Schema.String,
  exitCode: Schema.Finite,
}) {}

const git = Effect.fn("git")(function* git(
  repositoryRoot: string,
  gitArguments: readonly string[],
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make("git", [...gitArguments], {
      cwd: repositoryRoot,
      env: {
        GIT_AUTHOR_DATE: "1700000000 +0000",
        GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
        GIT_AUTHOR_NAME: "Stop AI Slop",
        GIT_COMMITTER_DATE: "1700000000 +0000",
        GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
        GIT_COMMITTER_NAME: "Stop AI Slop",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        HOME: repositoryRoot,
        PATH: yield* Config.String("PATH"),
      },
      stdin: "ignore",
      stderr: "ignore",
    }),
  );
  const [answered, exitCode] = yield* Effect.all(
    [Stream.mkString(Stream.decodeText(handle.stdout)), handle.exitCode],
    { concurrency: "unbounded" },
  );
  return exitCode === 0
    ? answered
    : yield* new GitFixtureRefused({ command: gitArguments.join(" "), exitCode });
}, Effect.scoped);

const writeSource = Effect.fn("writeSource")(function* writeSource(
  repositoryRoot: string,
  relativePath: string,
  sourceText: string,
) {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  yield* filesystem.writeFileString(paths.join(repositoryRoot, relativePath), sourceText);
});

const commitSnapshot = Effect.fn("commitSnapshot")(function* commitSnapshot(
  repositoryRoot: string,
) {
  yield* git(repositoryRoot, ["add", "--all"]);
  yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
});

const repositoryHoldingCurrent = Effect.gen(function* repositoryHoldingCurrent() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "stop-ai-slop-" });
  yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
  yield* git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
  yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
  yield* commitSnapshot(repositoryRoot);
  return repositoryRoot;
});

const repositoryMergingRepairedFeature = Effect.gen(function* repositoryMergingRepairedFeature() {
  const repositoryRoot = yield* repositoryHoldingCurrent;
  yield* git(repositoryRoot, ["switch", "--quiet", "--create", "feature"]);
  yield* writeSource(repositoryRoot, "src/repaired.ts", "\0binary\0");
  yield* commitSnapshot(repositoryRoot);
  yield* git(repositoryRoot, ["switch", "--quiet", "main"]);
  yield* writeSource(repositoryRoot, "src/main-only.ts", "export const mainOnly = true;\n");
  yield* commitSnapshot(repositoryRoot);
  yield* git(repositoryRoot, ["merge", "--quiet", "--no-commit", "--no-ff", "feature"]);
  yield* writeSource(repositoryRoot, "src/repaired.ts", "export const repaired = true;\n");
  yield* git(repositoryRoot, ["add", "src/repaired.ts"]);
  return repositoryRoot;
});

const repositoryHoldingOnlyThePullRequestMerge = Effect.gen(
  function* repositoryHoldingOnlyThePullRequestMerge() {
    const repositoryRoot = yield* repositoryHoldingCurrent;
    const baseCommit = (yield* git(repositoryRoot, ["rev-parse", "HEAD"])).trim();
    yield* git(repositoryRoot, ["branch", "feature", baseCommit]);
    yield* writeSource(repositoryRoot, "src/current.ts", "export const current = false;\n");
    yield* commitSnapshot(repositoryRoot);
    const headCommit = (yield* git(repositoryRoot, ["rev-parse", "HEAD"])).trim();
    const headTree = (yield* git(repositoryRoot, ["rev-parse", `${headCommit}^{tree}`])).trim();
    const mergeCommit = (yield* git(repositoryRoot, [
      "commit-tree",
      headTree,
      "-p",
      baseCommit,
      "-p",
      headCommit,
      "-m",
      "pull request merge",
    ])).trim();
    yield* git(repositoryRoot, ["reset", "--hard", "--quiet", mergeCommit]);
    const compare = vi.fn<GitHubRequest>(() =>
      Effect.succeed({ merge_base_commit: { sha: baseCommit }, files: [] }),
    );
    return { repositoryRoot, compare };
  },
);

layer(Layer.merge(NodeServices.layer, gitEnvironmentLayer))("resolvedComparison", (it) => {
  describe("a checkout that holds the integration branch", () => {
    const integrationBranchComparison = Effect.gen(function* integrationBranchComparison() {
      const repositoryRoot = yield* repositoryHoldingCurrent;
      yield* git(repositoryRoot, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = false;\n");
      yield* commitSnapshot(repositoryRoot);
      return {
        repositoryRoot,
        comparison: yield* resolvedComparison(repositoryRoot, {
          repository: undefined,
          request: null,
        }),
      };
    });

    it.effect("reads the local repository when it holds the integration branch", () =>
      Effect.gen(function* program() {
        const { repositoryRoot, comparison } = yield* integrationBranchComparison;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "2f9ca1284d91be6c277f0b4baf015234f3bfc8d1",
          headRevision: "HEAD",
          files: [
            {
              kind: "changed",
              beforePath: "src/current.ts",
              afterPath: "src/current.ts",
              beforeSource: "export const current = true;\n",
              afterSource: "export const current = false;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
          ],
        });
      }),
    );
  });

  describe("a checkout with a merge in progress", () => {
    const mergeInProgressComparison = Effect.gen(function* mergeInProgressComparison() {
      const repositoryRoot = yield* repositoryMergingRepairedFeature;
      return {
        repositoryRoot,
        comparison: yield* resolvedComparison(repositoryRoot, {
          repository: undefined,
          request: null,
        }),
      };
    });

    const mergeInProgressFeatureTip = Effect.flatMap(
      repositoryMergingRepairedFeature,
      (repositoryRoot) => git(repositoryRoot, ["rev-parse", "feature"]),
    );

    it.effect("reads the resolved index while a merge is in progress", () =>
      Effect.gen(function* program() {
        const { repositoryRoot, comparison } = yield* mergeInProgressComparison;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "2f9ca1284d91be6c277f0b4baf015234f3bfc8d1",
          headRevision: "2efaee1d31f0187056e65c845e898a617d530942",
          files: [
            {
              kind: "added",
              beforePath: null,
              afterPath: "src/main-only.ts",
              beforeSource: null,
              afterSource: "export const mainOnly = true;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
            {
              kind: "added",
              beforePath: null,
              afterPath: "src/repaired.ts",
              beforeSource: null,
              afterSource: "export const repaired = true;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
          ],
        });
      }),
    );

    it.effect("does not read the merged branch tip as the compared head", () =>
      Effect.gen(function* program() {
        expect(yield* mergeInProgressFeatureTip).not.toBe(
          "2efaee1d31f0187056e65c845e898a617d530942\n",
        );
      }),
    );
  });

  describe("a checkout that holds only the merge of a pull request", () => {
    const pullRequestComparison = Effect.gen(function* pullRequestComparison() {
      const { repositoryRoot, compare } = yield* repositoryHoldingOnlyThePullRequestMerge;
      return {
        repositoryRoot,
        comparison: yield* resolvedComparison(repositoryRoot, {
          repository: "owner/name",
          request: compare,
        }),
      };
    });

    const pullRequestCompareCall = Effect.gen(function* pullRequestCompareCall() {
      const { repositoryRoot, compare } = yield* repositoryHoldingOnlyThePullRequestMerge;
      yield* resolvedComparison(repositoryRoot, { repository: "owner/name", request: compare });
      return compare;
    });

    it.effect("reads the pull request through the API when the checkout holds only its merge", () =>
      Effect.gen(function* program() {
        const { repositoryRoot, comparison } = yield* pullRequestComparison;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "2f9ca1284d91be6c277f0b4baf015234f3bfc8d1",
          headRevision: "d8fde84998100e7b6119bddff27a36a2e20e9ad6",
          files: [],
        });
      }),
    );

    it.effect("asks the compare endpoint for the range spanned by the merged parents", () =>
      Effect.gen(function* program() {
        expect(yield* pullRequestCompareCall).toHaveBeenCalledExactlyOnceWith(
          "/repos/owner/name/compare/2f9ca1284d91be6c277f0b4baf015234f3bfc8d1...d8fde84998100e7b6119bddff27a36a2e20e9ad6",
        );
      }),
    );
  });

  describe("a checkout that holds neither the integration branch nor a merge", () => {
    const guessworkRefusal = Effect.flatMap(repositoryHoldingCurrent, (repositoryRoot) =>
      Effect.flip(resolvedComparison(repositoryRoot, { repository: undefined, request: null })),
    );

    it.effect("refuses a checkout that holds neither the integration branch nor a merge", () =>
      Effect.gen(function* program() {
        const refusal = yield* guessworkRefusal;
        expect(refusal).toBeInstanceOf(ComparisonUnresolved);
        expect(refusal.message).toBe(
          "Do not leave the compared change to guesswork: this checkout holds neither origin/main nor a pull request merge to read. Fetch the integration branch, or name both ends with --base and --head.",
        );
      }),
    );
  });
});
