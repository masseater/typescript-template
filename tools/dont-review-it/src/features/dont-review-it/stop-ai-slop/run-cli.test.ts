import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect, vi } from "vite-plus/test";

import { gitExecutablePath } from "../repository-checks/index.ts";
import { runStopAiSlop } from "./run-cli.ts";

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

const stopAiSlopAnswer = (argv: readonly string[]) => Effect.promise(() => runStopAiSlop(argv));

const USAGE_TEXT = `Usage: stop-ai-slop check [--base <revision> --head <revision>] [--repository-root <path>]

Commands:
  check   Run every registered check in definition order.

Options:
  --base <revision>         Git revision before the change. Requires --head.
  --head <revision>         Git revision after the change. Requires --base.
  --repository-root <path>  Root of the Git repository. Defaults to the current working directory.

Without --base and --head the change on its way into the integration branch is compared:
the staged merge result when a merge is in progress, and the history since it left
origin/main otherwise.
`;

const REMOVAL_PROBLEM_LINE =
  'src/legacy-api.test.ts:4 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n';

const REMOVAL_VERIFYING_SPEC =
  'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nexpect(legacy).not.toHaveProperty("legacyMode");\n';

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
    yield* git(repositoryRoot, ["checkout", "--quiet", "-b", "feature", "branch-point"]);
    yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
    yield* writeSource(repositoryRoot, "src/legacy-api.test.ts", REMOVAL_VERIFYING_SPEC);
    yield* commitSnapshot(repositoryRoot);
    return repositoryRoot;
  },
);

layer(NodeServices.layer)("runStopAiSlop", (it) => {
  describe("an argument list naming no command at all", () => {
    it.effect("refuses the run and writes the usage text", () =>
      Effect.gen(function* program() {
        expect(yield* stopAiSlopAnswer([])).toStrictEqual({
          exitCode: 2,
          out: "",
          error: USAGE_TEXT,
        });
      }),
    );
  });

  describe("an argument list naming a command the runner does not carry", () => {
    it.effect("refuses the run and writes the usage text", () =>
      Effect.gen(function* program() {
        expect(yield* stopAiSlopAnswer(["scan"])).toStrictEqual({
          exitCode: 2,
          out: "",
          error: USAGE_TEXT,
        });
      }),
    );
  });

  describe("a check command carrying a positional beside its own name", () => {
    it.effect("refuses the run and writes the usage text", () =>
      Effect.gen(function* program() {
        expect(yield* stopAiSlopAnswer(["check", "extra"])).toStrictEqual({
          exitCode: 2,
          out: "",
          error: USAGE_TEXT,
        });
      }),
    );
  });

  describe("a check command carrying an option the runner does not declare", () => {
    it.effect("refuses the run and writes the usage text", () =>
      Effect.gen(function* program() {
        expect(yield* stopAiSlopAnswer(["check", "--unknown"])).toStrictEqual({
          exitCode: 2,
          out: "",
          error: USAGE_TEXT,
        });
      }),
    );
  });

  describe("a check command whose base is empty", () => {
    it.effect("refuses the run and writes the usage text", () =>
      Effect.gen(function* program() {
        expect(yield* stopAiSlopAnswer(["check", "--base", ""])).toStrictEqual({
          exitCode: 2,
          out: "",
          error: USAGE_TEXT,
        });
      }),
    );
  });

  describe("a check command naming a base without naming a head", () => {
    it.effect("refuses the run and writes the usage text", () =>
      Effect.gen(function* program() {
        expect(yield* stopAiSlopAnswer(["check", "--base", "base"])).toStrictEqual({
          exitCode: 2,
          out: "",
          error: USAGE_TEXT,
        });
      }),
    );
  });

  describe("a check command naming a base whose head is empty", () => {
    it.effect("refuses the run and writes the usage text", () =>
      Effect.gen(function* program() {
        expect(yield* stopAiSlopAnswer(["check", "--base", "base", "--head", ""])).toStrictEqual({
          exitCode: 2,
          out: "",
          error: USAGE_TEXT,
        });
      }),
    );
  });

  describe("a head every registered check passes", () => {
    const passingCheck = Effect.flatMap(repositoryChangingCurrent, (repositoryRoot) =>
      stopAiSlopAnswer([
        "check",
        "--repository-root",
        repositoryRoot,
        "--base",
        "HEAD~1",
        "--head",
        "HEAD",
      ]),
    );

    it.effect("stays silent and reports success", () =>
      Effect.gen(function* program() {
        expect(yield* passingCheck).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("a checkout that holds neither the integration branch nor a merge", () => {
    const unresolvedCheck = Effect.flatMap(repositoryChangingCurrent, (repositoryRoot) =>
      stopAiSlopAnswer(["check", "--repository-root", repositoryRoot]),
    );

    it.effect("refuses the run and names the missing comparison", () =>
      Effect.gen(function* program() {
        expect(yield* unresolvedCheck).toStrictEqual({
          exitCode: 2,
          out: "",
          error:
            "Do not leave the compared change to guesswork: this checkout holds neither origin/main nor a pull request merge to read. Fetch the integration branch, or name both ends with --base and --head.\n",
        });
      }),
    );
  });

  describe("a run naming no repository root", () => {
    const workingDirectoryCheck = Effect.gen(function* workingDirectoryCheck() {
      const repositoryRoot = yield* repositoryChangingCurrent;
      vi.spyOn(process, "cwd").mockReturnValue(repositoryRoot);
      return yield* stopAiSlopAnswer(["check", "--base", "HEAD~1", "--head", "HEAD"]);
    });

    it.effect("reads the repository at the current working directory", () =>
      Effect.gen(function* program() {
        expect(yield* workingDirectoryCheck).toStrictEqual({ exitCode: 0, out: "", error: "" });
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

    const checkAgainst = (base: string) =>
      Effect.flatMap(repositoryWithABranchBehindTheRemoval, (repositoryRoot) =>
        stopAiSlopAnswer([
          "check",
          "--repository-root",
          repositoryRoot,
          "--base",
          base,
          "--head",
          "feature",
        ]),
      );

    it.effect("left the branch point standing as the merge base of the two branches", () =>
      Effect.gen(function* program() {
        const { mergeBaseRevision, branchPointRevision } = yield* branchRevisions;
        expect(mergeBaseRevision).toBe(branchPointRevision);
      }),
    );

    it.effect("sees no removal when the base is the tip of the integration branch", () =>
      Effect.gen(function* program() {
        expect(yield* checkAgainst("main")).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );

    it.effect("names the stale removal when the base is the merge base", () =>
      Effect.gen(function* program() {
        expect(yield* checkAgainst("branch-point")).toStrictEqual({
          exitCode: 1,
          out: REMOVAL_PROBLEM_LINE,
          error: "",
        });
      }),
    );
  });

  describe("a head carrying a stale removal and no named revision", () => {
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
      return yield* stopAiSlopAnswer(["check", "--repository-root", repositoryRoot]);
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

  describe("a base revision the repository does not carry", () => {
    const missingBaseRefusal = Effect.gen(function* missingBaseRefusal() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
      yield* commitSnapshot(repositoryRoot);
      return yield* stopAiSlopAnswer([
        "check",
        "--repository-root",
        repositoryRoot,
        "--base",
        "missing-revision",
        "--head",
        "HEAD",
      ]);
    });

    it.effect("fails closed and names the command that refused", () =>
      Effect.gen(function* program() {
        const searchPath = yield* Config.String("PATH");
        expect(yield* missingBaseRefusal).toStrictEqual({
          exitCode: 2,
          out: "",
          error: `Command failed: ${gitExecutablePath(searchPath)} rev-parse --verify --end-of-options missing-revision^{tree}\nfatal: Needed a single revision\n\n`,
        });
      }),
    );
  });

  describe("a head carrying a relevant source the parser cannot read", () => {
    const unreadableSourceRefusal = Effect.gen(function* unreadableSourceRefusal() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacyMode = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = ;\n");
      yield* commitSnapshot(repositoryRoot);
      return yield* stopAiSlopAnswer([
        "check",
        "--repository-root",
        repositoryRoot,
        "--base",
        "HEAD~1",
        "--head",
        "HEAD",
      ]);
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
