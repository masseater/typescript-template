import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, ConfigProvider, Effect, FileSystem, Layer, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { gitEnvironmentLayer, runGitText } from "./git-text.ts";

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

layer(Layer.merge(NodeServices.layer, gitEnvironmentLayer))("runGitText", (it) => {
  describe("a successful Git command that writes to stderr", () => {
    const stderrRejection = Effect.gen(function* stderrRejection() {
      const filesystem = yield* FileSystem.FileSystem;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "stop-ai-slop-git-text-",
      });
      yield* git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--allow-empty", "--message", "snapshot"]);
      yield* git(repositoryRoot, ["tag", "main"]);
      return yield* runGitText({ repositoryRoot, args: ["rev-parse", "main"] }).pipe(
        Effect.flip,
        Effect.provide(Layer.fresh(gitEnvironmentLayer)),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({
            env: { HOME: repositoryRoot, PATH: yield* Config.String("PATH") },
          }),
        ),
      );
    });

    it.effect("rejects with an error carrying the stderr text", () =>
      Effect.gen(function* program() {
        const rejection = yield* stderrRejection;
        expect(rejection.message).toBe(
          "Git command wrote to stderr: warning: refname 'main' is ambiguous.\n",
        );
      }),
    );
  });
});
