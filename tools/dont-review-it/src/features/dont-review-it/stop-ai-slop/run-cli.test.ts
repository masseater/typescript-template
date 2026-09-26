import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, ConfigProvider, Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { gitExecutablePath } from "../repository-checks/index.ts";
import { stopAiSlop } from "./run-cli.ts";

class GitFixtureRefused extends Schema.TaggedError<GitFixtureRefused>()("GitFixtureRefused", {
  command: Schema.String,
  exitCode: Schema.Finite,
  stderr: Schema.String,
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
        GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
        GIT_AUTHOR_NAME: "Stop AI Slop",
        GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
        GIT_COMMITTER_NAME: "Stop AI Slop",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        HOME: repositoryRoot,
        PATH: yield* Config.String("PATH"),
      },
      stdin: "ignore",
    }),
  );
  const [answered, refusal, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode,
    ],
    { concurrency: "unbounded" },
  );
  return exitCode === 0
    ? answered
    : yield* GitFixtureRefused.make({ command: gitArguments.join(" "), exitCode, stderr: refusal });
}, Effect.scoped);

const writeSource = Effect.fn("writeSource")(function* writeSource(
  repositoryRoot: string,
  relativePath: string,
  sourceText: string,
) {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const absolutePath = paths.join(repositoryRoot, relativePath);
  yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
  yield* filesystem.writeFileString(absolutePath, sourceText);
});

const commitSnapshot = Effect.fn("commitSnapshot")(function* commitSnapshot(
  repositoryRoot: string,
) {
  yield* git(repositoryRoot, ["add", "--all"]);
  yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
});

const newRepository = Effect.gen(function* newRepository() {
  const filesystem = yield* FileSystem.FileSystem;
  const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "stop-ai-slop-" });
  yield* git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
  return repositoryRoot;
});

const withEnvironmentOf = (variables: Readonly<Record<string, string>>) =>
  Effect.gen(function* withEnvironmentOf() {
    return ConfigProvider.fromEnv({ env: { PATH: yield* Config.String("PATH"), ...variables } });
  });

const answerWithout = (repositoryRoot: string, variables: Readonly<Record<string, string>>) =>
  Effect.flatMap(withEnvironmentOf(variables), (provider) =>
    stopAiSlop({ repositoryRoot }).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, provider),
    ),
  );

const REMOVAL_PROBLEM_LINE =
  'src/legacy-api.test.ts:4 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n';

const REMOVAL_VERIFYING_SPEC =
  'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nexpect(legacy).not.toHaveProperty("legacyMode");\n';

const GUESSWORK_REFUSAL =
  "Do not leave the compared change to guesswork: this checkout holds neither origin/main nor the parents of a pull request merge, and no GitHub API to read the merge through. Fetch the integration branch or the merge with its parents before checking.\n";

const repositoryChangingCurrent = Effect.gen(function* repositoryChangingCurrent() {
  const repositoryRoot = yield* newRepository;
  yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
  yield* commitSnapshot(repositoryRoot);
  yield* writeSource(repositoryRoot, "src/current.ts", "export const current = false;\n");
  yield* commitSnapshot(repositoryRoot);
  return repositoryRoot;
});

const repositoryWithABranchBehindTheRemoval = Effect.gen(
  function* repositoryWithABranchBehindTheRemoval() {
    const repositoryRoot = yield* newRepository;
    yield* writeSource(
      repositoryRoot,
      "src/legacy.ts",
      "export const current = true;\nexport const legacyMode = true;\n",
    );
    yield* commitSnapshot(repositoryRoot);
    yield* git(repositoryRoot, ["branch", "branch-point"]);
    yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = false;\n");
    yield* commitSnapshot(repositoryRoot);
    yield* git(repositoryRoot, ["update-ref", "refs/remotes/origin/main", "main"]);
    yield* git(repositoryRoot, ["checkout", "--quiet", "-b", "feature", "branch-point"]);
    yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
    yield* writeSource(repositoryRoot, "src/legacy-api.test.ts", REMOVAL_VERIFYING_SPEC);
    yield* commitSnapshot(repositoryRoot);
    return repositoryRoot;
  },
);

layer(NodeServices.layer)("stopAiSlop", (it) => {
  describe("a head every registered check passes", () => {
    const passingCheck = Effect.gen(function* passingCheck() {
      const repositoryRoot = yield* repositoryChangingCurrent;
      yield* git(repositoryRoot, ["update-ref", "refs/remotes/origin/main", "HEAD~1"]);
      return yield* answerWithout(repositoryRoot, {});
    });

    it.effect("stays silent and reports success", () =>
      Effect.gen(function* program() {
        expect(yield* passingCheck).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("a checkout that holds neither the integration branch nor a merge", () => {
    const unresolvedCheck = Effect.flatMap(repositoryChangingCurrent, (repositoryRoot) =>
      answerWithout(repositoryRoot, {}),
    );

    it.effect("refuses the run and names the missing comparison", () =>
      Effect.gen(function* program() {
        expect(yield* unresolvedCheck).toStrictEqual({
          exitCode: 2,
          out: "",
          error: GUESSWORK_REFUSAL,
        });
      }),
    );
  });

  describe("a pull request merge checked with an empty token", () => {
    const emptyTokenCheck = Effect.gen(function* emptyTokenCheck() {
      const repositoryRoot = yield* repositoryChangingCurrent;
      yield* git(repositoryRoot, ["checkout", "--quiet", "-b", "feature", "HEAD~1"]);
      yield* writeSource(repositoryRoot, "src/feature.ts", "export const feature = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* git(repositoryRoot, ["checkout", "--quiet", "main"]);
      yield* git(repositoryRoot, ["merge", "--quiet", "--no-ff", "--no-edit", "feature"]);
      const mergeCommit = (yield* git(repositoryRoot, ["rev-parse", "HEAD"])).trim();
      const checkoutRoot = yield* newRepository;
      yield* git(checkoutRoot, ["remote", "add", "origin", `file://${repositoryRoot}`]);
      yield* git(checkoutRoot, [
        "fetch",
        "--quiet",
        "--no-tags",
        "--depth=1",
        "origin",
        mergeCommit,
      ]);
      yield* git(checkoutRoot, ["checkout", "--quiet", "--detach", mergeCommit]);
      return yield* answerWithout(checkoutRoot, {
        GITHUB_REPOSITORY: "owner/name",
        GITHUB_TOKEN: "",
      });
    });

    it.effect("asks nothing of the API and names the missing comparison", () =>
      Effect.gen(function* program() {
        expect(yield* emptyTokenCheck).toStrictEqual({
          exitCode: 2,
          out: "",
          error: GUESSWORK_REFUSAL,
        });
      }),
    );
  });

  describe("a feature branch that left the integration branch before a removal landed", () => {
    const branchRevisions = Effect.gen(function* branchRevisions() {
      const repositoryRoot = yield* repositoryWithABranchBehindTheRemoval;
      return {
        mergeBaseRevision: yield* git(repositoryRoot, ["merge-base", "main", "feature"]),
        branchPointRevision: yield* git(repositoryRoot, ["rev-parse", "branch-point"]),
      };
    });

    const featureCheck = Effect.flatMap(repositoryWithABranchBehindTheRemoval, (repositoryRoot) =>
      answerWithout(repositoryRoot, {}),
    );

    it.effect("left the branch point standing as the merge base of the two branches", () =>
      Effect.gen(function* program() {
        const { mergeBaseRevision, branchPointRevision } = yield* branchRevisions;
        expect(mergeBaseRevision).toBe(branchPointRevision);
      }),
    );

    it.effect("names the removal the branch makes against the merge base", () =>
      Effect.gen(function* program() {
        expect(yield* featureCheck).toStrictEqual({
          exitCode: 1,
          out: REMOVAL_PROBLEM_LINE,
          error: "",
        });
      }),
    );
  });

  describe("a head carrying a stale removal since the integration branch", () => {
    const integrationBranchCheck = Effect.gen(function* integrationBranchCheck() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* git(repositoryRoot, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(repositoryRoot, "src/legacy-api.test.ts", REMOVAL_VERIFYING_SPEC);
      yield* commitSnapshot(repositoryRoot);
      return yield* answerWithout(repositoryRoot, {});
    });

    it.effect("compares the history since the integration branch", () =>
      Effect.gen(function* program() {
        expect(yield* integrationBranchCheck).toStrictEqual({
          exitCode: 1,
          out: REMOVAL_PROBLEM_LINE,
          error: "",
        });
      }),
    );
  });

  describe("an integration branch that shares no history with the head", () => {
    const unrelatedHistoryRefusal = Effect.gen(function* unrelatedHistoryRefusal() {
      const repositoryRoot = yield* repositoryChangingCurrent;
      const tree = (yield* git(repositoryRoot, ["rev-parse", "HEAD^{tree}"])).trim();
      const unrelated = (yield* git(repositoryRoot, [
        "commit-tree",
        tree,
        "-m",
        "unrelated",
      ])).trim();
      yield* git(repositoryRoot, ["update-ref", "refs/remotes/origin/main", unrelated]);
      return { unrelated, answer: yield* answerWithout(repositoryRoot, {}) };
    });

    it.effect("fails closed and names the command that refused", () =>
      Effect.gen(function* program() {
        const executable = gitExecutablePath(yield* Config.String("PATH"));
        const { unrelated, answer } = yield* unrelatedHistoryRefusal;
        expect(answer).toStrictEqual({
          exitCode: 2,
          out: "",
          error: `Command failed: ${executable} merge-base ${unrelated} HEAD\n\n`,
        });
      }),
    );
  });

  describe("a head carrying a relevant source the parser cannot read", () => {
    const unreadableSourceRefusal = Effect.gen(function* unreadableSourceRefusal() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacyMode = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* git(repositoryRoot, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = ;\n");
      yield* commitSnapshot(repositoryRoot);
      return yield* answerWithout(repositoryRoot, {});
    });

    it.effect("fails closed and names the source it could not read", () =>
      Effect.gen(function* program() {
        expect(yield* unreadableSourceRefusal).toStrictEqual({
          exitCode: 2,
          out: "",
          error: "src/legacy.ts: Unexpected token\n",
        });
      }),
    );
  });
});
