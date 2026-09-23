import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Layer, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { comparisonRangeIn } from "./comparison-range.ts";
import { gitEnvironmentLayer } from "./git-text.ts";

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
        GIT_AUTHOR_DATE: "@946684800 +0000",
        GIT_AUTHOR_EMAIL: "comparison-range@example.test",
        GIT_AUTHOR_NAME: "Comparison Range",
        GIT_COMMITTER_DATE: "@946684800 +0000",
        GIT_COMMITTER_EMAIL: "comparison-range@example.test",
        GIT_COMMITTER_NAME: "Comparison Range",
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

const commitSource = Effect.fn("commitSource")(function* commitSource(
  repositoryRoot: string,
  relativePath: string,
  sourceText: string,
  message: string,
) {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  yield* filesystem.writeFileString(paths.join(repositoryRoot, relativePath), sourceText);
  yield* git(repositoryRoot, ["add", "--all"]);
  yield* git(repositoryRoot, ["commit", "--quiet", "--message", message]);
});

const freshRepository = Effect.gen(function* freshRepository() {
  const filesystem = yield* FileSystem.FileSystem;
  const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
    prefix: "comparison-range-",
  });
  yield* git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
  yield* commitSource(repositoryRoot, "shared.ts", "export const shared = true;\n", "shared");
  return repositoryRoot;
});

const repositoryMergingFeature = Effect.gen(function* repositoryMergingFeature() {
  const repositoryRoot = yield* freshRepository;
  yield* git(repositoryRoot, ["switch", "--quiet", "--create", "feature"]);
  yield* commitSource(repositoryRoot, "feature.ts", "export const feature = true;\n", "feature");
  yield* git(repositoryRoot, ["switch", "--quiet", "main"]);
  yield* commitSource(
    repositoryRoot,
    "main-only.ts",
    "export const mainOnly = true;\n",
    "main only",
  );
  yield* git(repositoryRoot, ["merge", "--quiet", "--no-commit", "--no-ff", "feature"]);
  return repositoryRoot;
});

layer(Layer.merge(NodeServices.layer, gitEnvironmentLayer))("comparisonRangeIn", (it) => {
  const sharedCommitRevision = "2bd9e78c8de105cae8f7e2ee2626041c397fe893";
  const featureTipCommitRevision = "6558ebc69c85f6fe83d0f6324945fe524f5c9ba8";
  const mergedIndexTreeRevision = "34ce6086051fdb587dc8ecac255c7a02b7375c4d";

  describe("a repository holding a merge that has not been committed", () => {
    const comparisonRangeOfTheMergingRepository = Effect.flatMap(
      repositoryMergingFeature,
      comparisonRangeIn,
    );

    it.effect("compares the branch being merged against the point it left", () =>
      Effect.gen(function* program() {
        expect(yield* comparisonRangeOfTheMergingRepository).toStrictEqual({
          baseRevision: sharedCommitRevision,
          headRevision: mergedIndexTreeRevision,
        });
      }),
    );
  });

  describe("a repository whose merge holds a tree the merged branch never carried", () => {
    const comparisonRangeOfTheRepositoryMergingTheFeatureTip = Effect.flatMap(
      repositoryMergingFeature,
      comparisonRangeIn,
    );

    it.effect("refuses the tip of the branch being merged as the head revision", () =>
      Effect.gen(function* program() {
        expect(yield* comparisonRangeOfTheRepositoryMergingTheFeatureTip).not.toStrictEqual({
          baseRevision: sharedCommitRevision,
          headRevision: featureTipCommitRevision,
        });
      }),
    );
  });

  describe("a repository whose checked out history moved past the integration branch", () => {
    const comparisonRangeOfTheDivergedRepository = Effect.gen(
      function* comparisonRangeOfTheDivergedRepository() {
        const repositoryRoot = yield* freshRepository;
        yield* git(repositoryRoot, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
        yield* commitSource(repositoryRoot, "later.ts", "export const later = true;\n", "later");
        return yield* comparisonRangeIn(repositoryRoot);
      },
    );

    it.effect(
      "compares the checked out history against the point it left the integration branch",
      () =>
        Effect.gen(function* program() {
          expect(yield* comparisonRangeOfTheDivergedRepository).toStrictEqual({
            baseRevision: sharedCommitRevision,
            headRevision: "HEAD",
          });
        }),
    );
  });

  describe("a repository carrying no integration branch", () => {
    const comparisonRangeOfTheSoleBranchRepository = Effect.flatMap(
      freshRepository,
      comparisonRangeIn,
    );

    it.effect("names no range when the integration branch is absent", () =>
      Effect.gen(function* program() {
        expect(yield* comparisonRangeOfTheSoleBranchRepository).toBe(null);
      }),
    );
  });
});
