import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { attempt } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { DiffUnreadable, parseRepositoryChanges } from "./repository-diff.ts";

const nulCharacter = String.fromCodePoint(0);

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
    : yield* new GitFixtureRefused({ command: gitArguments.join(" "), exitCode, stderr: refusal });
}, Effect.scoped);

const refusalOf = (inventoryOutput: string, diff: string): unknown => {
  const [rejection] = attempt<unknown, unknown>(() =>
    parseRepositoryChanges({ inventoryOutput, diff }),
  );
  return rejection;
};

const SHARED_DIFF_ARGUMENTS = [
  "-c",
  "core.quotePath=false",
  "-c",
  "diff.renameLimit=0",
  "diff",
  "--default-prefix",
  "--find-renames",
  "--no-ext-diff",
  "--no-textconv",
  "--no-color",
];

const realGitTypeChange = Effect.gen(function* realGitTypeChange() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "stop-ai-slop-" });
  const sourcePath = paths.resolve(repositoryRoot, "src/current.ts");
  yield* git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
  yield* filesystem.makeDirectory(paths.resolve(repositoryRoot, "src"), { recursive: true });
  yield* filesystem.writeFileString(sourcePath, "export const current = true;\n");
  yield* git(repositoryRoot, ["add", "--all"]);
  yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
  yield* filesystem.remove(sourcePath);
  yield* filesystem.symlink("target.ts", sourcePath);
  yield* git(repositoryRoot, ["add", "--all"]);
  yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
  return {
    inventoryOutput: yield* git(repositoryRoot, [
      ...SHARED_DIFF_ARGUMENTS,
      "--name-status",
      "-z",
      "HEAD~1",
      "HEAD",
      "--",
    ]),
    diff: yield* git(repositoryRoot, [
      ...SHARED_DIFF_ARGUMENTS,
      "--unified=0",
      "HEAD~1",
      "HEAD",
      "--",
    ]),
  };
});

describe("parseRepositoryChanges", () => {
  test("hands back no changes for empty metadata and patch", () => {
    expect(parseRepositoryChanges({ inventoryOutput: "", diff: "" })).toStrictEqual([]);
  });

  test("refuses a non-empty diff that produces no files", () => {
    expect(refusalOf("", "not a git diff\n")).toStrictEqual(
      new DiffUnreadable({ message: "Unable to parse non-empty Git diff" }),
    );
  });

  test("refuses inventory text that carries no NUL delimiters", () => {
    expect(refusalOf("invalid metadata", "")).toStrictEqual(
      new DiffUnreadable({ message: "Invalid NUL-delimited Git diff metadata" }),
    );
  });

  test("refuses an inventory record whose path is empty", () => {
    expect(refusalOf(`A${nulCharacter}${nulCharacter}`, "")).toStrictEqual(
      new DiffUnreadable({ message: "Invalid NUL-delimited Git diff metadata" }),
    );
  });

  test("refuses a rename record whose source path is empty", () => {
    expect(
      refusalOf(`R100${nulCharacter}${nulCharacter}src/current.ts${nulCharacter}`, ""),
    ).toStrictEqual(new DiffUnreadable({ message: "Invalid NUL-delimited Git diff metadata" }));
  });

  test("refuses an inventory status the parser does not know", () => {
    expect(refusalOf(`X${nulCharacter}src/current.ts${nulCharacter}`, "")).toStrictEqual(
      new DiffUnreadable({ message: "Unsupported Git diff status" }),
    );
  });

  test("refuses an inventory file the patch omits", () => {
    expect(refusalOf(`A${nulCharacter}src/added.ts${nulCharacter}`, "")).toStrictEqual(
      new DiffUnreadable({ message: "Git diff metadata and patch file counts disagree: 1 != 0" }),
    );
  });

  test("refuses a patch whose file type disagrees with the inventory", () => {
    expect(
      refusalOf(
        `D${nulCharacter}src/current.ts${nulCharacter}`,
        `diff --git src/current.ts src/current.ts
new file mode 100644
index 0000000..6cd59c7
--- /dev/null
+++ src/current.ts
@@ -0,0 +1 @@
+export const current = true;
`,
      ),
    ).toStrictEqual(
      new DiffUnreadable({
        message: "Git diff metadata and patch disagree: DeletedFile != AddedFile",
      }),
    );
  });
});

layer(NodeServices.layer)("parseRepositoryChanges over real Git output", (it) => {
  it.effect("reconciles a real Git type change as deleted then added", () =>
    Effect.gen(function* program() {
      expect(parseRepositoryChanges(yield* realGitTypeChange)).toStrictEqual([
        {
          kind: "changed",
          beforePath: "src/current.ts",
          afterPath: "src/current.ts",
          addedLines: [1],
        },
      ]);
    }),
  );

  it.effect("refuses a real Git type change whose patch files arrive reversed", () =>
    Effect.gen(function* program() {
      const { inventoryOutput, diff } = yield* realGitTypeChange;
      const patchFiles = diff.split(/(?=diff --git )/u);
      expect(refusalOf(inventoryOutput, patchFiles.toReversed().join(""))).toStrictEqual(
        new DiffUnreadable({
          message: "Git diff metadata and patch disagree: DeletedFile != AddedFile",
        }),
      );
    }),
  );
});
