import { Config, Effect, FileSystem, Path, Schema } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { vi } from "vite-plus/test";

import { capturedProcess } from "./captured-process.ts";

const IDENTITY = "quality@example.test";

const NO_CONFIGURATION = "/dev/null";

const AUTHORED_AT = "@946684800 +0000";

class FixtureGitFailed extends Schema.TaggedError<FixtureGitFailed>()("FixtureGitFailed", {
  command: Schema.String,
  exitCode: Schema.Int,
}) {}

class MergeResolvedConflict extends Schema.TaggedError<MergeResolvedConflict>()(
  "MergeResolvedConflict",
  { file: Schema.String },
) {}

const gitEnvironment = (root: string) =>
  Effect.gen(function* gitEnvironment() {
    return {
      GIT_AUTHOR_DATE: AUTHORED_AT,
      GIT_AUTHOR_EMAIL: IDENTITY,
      GIT_AUTHOR_NAME: "quality",
      GIT_COMMITTER_DATE: AUTHORED_AT,
      GIT_COMMITTER_EMAIL: IDENTITY,
      GIT_COMMITTER_NAME: "quality",
      GIT_CONFIG_GLOBAL: NO_CONFIGURATION,
      GIT_CONFIG_SYSTEM: NO_CONFIGURATION,
      HOME: root,
      PATH: yield* Config.String("PATH").pipe(Config.withDefault("")),
    };
  });

const output = (root: string, args: readonly string[]) =>
  Effect.gen(function* output() {
    const { exitCode, stdout } = yield* capturedProcess(
      ChildProcess.make("git", [...args], {
        cwd: root,
        env: yield* gitEnvironment(root),
        extendEnv: false,
        stdin: "ignore",
      }),
    );
    if (exitCode !== 0) {
      return yield* FixtureGitFailed.make({ command: args.join(" "), exitCode });
    }
    return stdout;
  });

const git = (root: string, ...args: readonly string[]) => Effect.asVoid(output(root, args));

const stage = (root: string, filename: string, content: string) =>
  Effect.gen(function* stage() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    yield* filesystem.writeFileString(paths.join(root, filename), content);
    yield* git(root, "add", filename);
  });

const CONFLICTED_FILE = "conflicted.txt";

const commit = (root: string, content: string) =>
  Effect.gen(function* commit() {
    yield* stage(root, CONFLICTED_FILE, content);
    yield* git(root, "commit", "-m", content.trim());
  });

const save = (root: string, filename: string, content: string) =>
  Effect.gen(function* save() {
    yield* stage(root, filename, content);
    yield* git(root, "commit", "-m", filename);
  });

const conflict = (root: string) =>
  Effect.gen(function* conflict() {
    yield* git(root, "checkout", "-b", "side");
    yield* commit(root, "side\n");
    yield* git(root, "checkout", "main");
    yield* commit(root, "main\n");
    yield* Effect.ignore(git(root, "merge", "side"));
    if ((yield* output(root, ["ls-files", "--unmerged"])) === "") {
      return yield* MergeResolvedConflict.make({ file: CONFLICTED_FILE });
    }
  });

const GIT_VARIABLE = "GIT_";

const withoutInheritedGitEnvironment = Effect.acquireRelease(
  Effect.sync(() => {
    for (const name of Object.keys(process.env).filter((each) => each.startsWith(GIT_VARIABLE))) {
      vi.stubEnv(name, undefined);
    }
  }),
  () =>
    Effect.sync(() => {
      vi.unstubAllEnvs();
    }),
);

const emptyDirectory = Effect.gen(function* emptyDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  yield* withoutInheritedGitEnvironment;
  return yield* filesystem.makeTempDirectoryScoped({ prefix: "template-index-" });
});

const repository = Effect.gen(function* repository() {
  const root = yield* emptyDirectory;
  yield* git(root, "init", "-b", "main");
  yield* commit(root, "base\n");
  return root;
});

export { CONFLICTED_FILE, conflict, emptyDirectory, repository, save, stage };
