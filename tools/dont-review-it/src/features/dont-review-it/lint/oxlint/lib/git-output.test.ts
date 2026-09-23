import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Path } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { gitOutput } from "./git-output.ts";

const cleanEnvironment = Effect.gen(function* cleanEnvironment() {
  return {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    HOME: yield* Config.String("HOME").pipe(Config.withDefault("")),
    PATH: yield* Config.String("PATH").pipe(Config.withDefault("")),
  };
});

layer(NodeServices.layer)("gitOutput", (it) => {
  describe("a question asked under a hook environment that names another repository and carries an unusable config count", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const environment = yield* cleanEnvironment;
      const repositoryRoot = yield* Effect.gen(function* repositoryRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const temporaryDirectory = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-git-output-",
        });
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        yield* spawner.exitCode(
          ChildProcess.make("git", ["init"], {
            cwd: temporaryDirectory,
            env: environment,
            stderr: "ignore",
            stdin: "ignore",
            stdout: "ignore",
          }),
        );
        return yield* filesystem.realPath(temporaryDirectory);
      });
      const toplevelAnswered = gitOutput(["rev-parse", "--show-toplevel"], {
        cwd: repositoryRoot,
        env: {
          ...environment,
          GIT_CONFIG_COUNT: "not-a-number",
          GIT_DIR: paths.join(repositoryRoot, "elsewhere", ".git"),
          GIT_INDEX_FILE: paths.join(repositoryRoot, "elsewhere", "index"),
        },
      });
      return { repositoryRoot, toplevelAnswered };
    });

    it.effect(
      "is answered about the asked directory, not about the repository the environment names",
      () =>
        Effect.gen(function* program() {
          const { toplevelAnswered, repositoryRoot } = yield* fixtures;
          expect(toplevelAnswered).toBe(repositoryRoot);
        }),
    );
  });

  describe("a question git answers with a failure status", () => {
    const fixture = Effect.gen(function* toplevelAnswered() {
      const filesystem = yield* FileSystem.FileSystem;
      const environment = yield* cleanEnvironment;
      return gitOutput(["rev-parse", "--show-toplevel"], {
        cwd: yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-git-output-bare-",
        }),
        env: environment,
      });
    });

    it.effect("yields null", () =>
      Effect.gen(function* program() {
        const toplevelAnswered = yield* fixture;
        expect(toplevelAnswered).toBe(null);
      }),
    );
  });
});
