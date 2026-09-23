import { NodeServices } from "@effect/platform-node";
import { it as effectIt, layer } from "@effect/vitest";
import { Config, ConfigProvider, Effect, FileSystem, Layer, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { gitEnvironmentLayer } from "./git-text.ts";
import { compareRevisions, decodedPreviousSource, decodedSource } from "./repository-comparison.ts";

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

const newRepository = Effect.gen(function* newRepository() {
  const filesystem = yield* FileSystem.FileSystem;
  const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
    prefix: "repository-comparison-",
  });
  yield* git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
  return repositoryRoot;
});

layer(Layer.merge(NodeServices.layer, gitEnvironmentLayer))("compareRevisions", (it) => {
  describe("a base and a head naming the same revision", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD",
          headRevision: "HEAD",
        }),
      };
    });

    it.effect("carries no file between the two", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD",
          headRevision: "HEAD",
          files: [],
        });
      }),
    );
  });

  describe("a head that adds, deletes, changes, and renames a file at once", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/changed.tsx",
        "export const Changed = () => <div />;\n",
      );
      yield* writeSource(repositoryRoot, "src/deleted.js", "export const deleted = true;\n");
      yield* writeSource(repositoryRoot, "assets/renamed.bin", "\0renamed\0");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      yield* writeSource(repositoryRoot, "src/added.ts", "export const added = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/changed.tsx",
        "export const Changed = () => <div />;\nexport const next = true;\n",
      );
      yield* writeSource(repositoryRoot, "assets/current.bin", "\0renamed\0");
      yield* filesystem.remove(paths.join(repositoryRoot, "src/deleted.js"));
      yield* filesystem.remove(paths.join(repositoryRoot, "assets/renamed.bin"));
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        }),
      };
    });

    it.effect("names every file with the change it carries", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
          files: [
            {
              kind: "renamed",
              beforePath: "assets/renamed.bin",
              afterPath: "assets/current.bin",
              beforeSource: null,
              afterSource: null,
              addedLines: [],
              firstAddedLine: null,
            },
            {
              kind: "added",
              beforePath: null,
              afterPath: "src/added.ts",
              beforeSource: null,
              afterSource: "export const added = true;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
            {
              kind: "changed",
              beforePath: "src/changed.tsx",
              afterPath: "src/changed.tsx",
              beforeSource: "export const Changed = () => <div />;\n",
              afterSource: "export const Changed = () => <div />;\nexport const next = true;\n",
              addedLines: [2],
              firstAddedLine: 2,
            },
            {
              kind: "deleted",
              beforePath: "src/deleted.js",
              afterPath: null,
              beforeSource: "export const deleted = true;\n",
              afterSource: null,
              addedLines: [],
              firstAddedLine: null,
            },
          ],
        });
      }),
    );
  });

  describe("a changed file whose path carries a space", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/with space.mjs", "export const value = 1;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      yield* writeSource(repositoryRoot, "src/with space.mjs", "export const value = 2;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        }),
      };
    });

    it.effect("keeps the space in the path and reads both blobs whole", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
          files: [
            {
              kind: "changed",
              beforePath: "src/with space.mjs",
              afterPath: "src/with space.mjs",
              beforeSource: "export const value = 1;\n",
              afterSource: "export const value = 2;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
          ],
        });
      }),
    );
  });

  describe("a file whose path carries a space and whose mode alone changes", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/with space.ts", "export const value = 1;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      yield* filesystem.chmod(paths.join(repositoryRoot, "src/with space.ts"), 0o755);
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        }),
      };
    });

    it.effect("keeps the space in the path and reports no added line", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
          files: [
            {
              kind: "changed",
              beforePath: "src/with space.ts",
              afterPath: "src/with space.ts",
              beforeSource: "export const value = 1;\n",
              afterSource: "export const value = 1;\n",
              addedLines: [],
              firstAddedLine: null,
            },
          ],
        });
      }),
    );
  });

  describe("a changed file whose path carries a tab", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/with\ttab.ts", "export const value = 1;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      yield* writeSource(repositoryRoot, "src/with\ttab.ts", "export const value = 2;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        }),
      };
    });

    it.effect("keeps the tab in the path and reads both blobs whole", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
          files: [
            {
              kind: "changed",
              beforePath: "src/with\ttab.ts",
              afterPath: "src/with\ttab.ts",
              beforeSource: "export const value = 1;\n",
              afterSource: "export const value = 2;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
          ],
        });
      }),
    );
  });

  describe("a head whose source carries a NUL", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      yield* writeSource(repositoryRoot, "src/current.ts", 'export const separator = "\0";\n');
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        }),
      };
    });

    it.effect("reads the NUL as a character of the source", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
          files: [
            {
              kind: "changed",
              beforePath: "src/current.ts",
              afterPath: "src/current.ts",
              beforeSource: "export const current = true;\n",
              afterSource: 'export const separator = "\0";\n',
              addedLines: [],
              firstAddedLine: null,
            },
          ],
        });
      }),
    );
  });

  describe("a regular file the head replaced with a symbolic link", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      yield* filesystem.remove(paths.join(repositoryRoot, "src/current.ts"));
      yield* filesystem.symlink("target.ts", paths.join(repositoryRoot, "src/current.ts"));
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        }),
      };
    });

    it.effect("calls the file changed and reads the link target as its source", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
          files: [
            {
              kind: "changed",
              beforePath: "src/current.ts",
              afterPath: "src/current.ts",
              beforeSource: "export const current = true;\n",
              afterSource: "target.ts",
              addedLines: [1],
              firstAddedLine: 1,
            },
          ],
        });
      }),
    );
  });

  describe("a repository configured to write diffs without the standard prefixes", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "b/legacy.ts", "export const value = 1;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      yield* git(repositoryRoot, ["config", "diff.noprefix", "true"]);
      yield* writeSource(repositoryRoot, "b/legacy.ts", "export const value = 2;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        }),
      };
    });

    it.effect("asks for the standard prefixes and reads the path whole", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
          files: [
            {
              kind: "changed",
              beforePath: "b/legacy.ts",
              afterPath: "b/legacy.ts",
              beforeSource: "export const value = 1;\n",
              afterSource: "export const value = 2;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
          ],
        });
      }),
    );
  });

  describe("a repository whose rename limit is lower than the number of renamed pairs", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/a.ts",
        "export const alpha = 1;\nexport const beta = 2;\nexport const gamma = 3;\n",
      );
      yield* writeSource(
        repositoryRoot,
        "src/b.ts",
        "export const delta = 4;\nexport const epsilon = 5;\nexport const zeta = 6;\n",
      );
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      yield* git(repositoryRoot, ["config", "diff.renameLimit", "1"]);
      yield* writeSource(
        repositoryRoot,
        "src/current-a.ts",
        "export const alpha = 9;\nexport const beta = 2;\nexport const gamma = 3;\n",
      );
      yield* writeSource(
        repositoryRoot,
        "src/current-b.ts",
        "export const delta = 9;\nexport const epsilon = 5;\nexport const zeta = 6;\n",
      );
      yield* filesystem.remove(paths.join(repositoryRoot, "src/a.ts"));
      yield* filesystem.remove(paths.join(repositoryRoot, "src/b.ts"));
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        }),
      };
    });

    it.effect("lifts the limit and pairs both renames", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
          files: [
            {
              kind: "renamed",
              beforePath: "src/a.ts",
              afterPath: "src/current-a.ts",
              beforeSource:
                "export const alpha = 1;\nexport const beta = 2;\nexport const gamma = 3;\n",
              afterSource:
                "export const alpha = 9;\nexport const beta = 2;\nexport const gamma = 3;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
            {
              kind: "renamed",
              beforePath: "src/b.ts",
              afterPath: "src/current-b.ts",
              beforeSource:
                "export const delta = 4;\nexport const epsilon = 5;\nexport const zeta = 6;\n",
              afterSource:
                "export const delta = 9;\nexport const epsilon = 5;\nexport const zeta = 6;\n",
              addedLines: [1],
              firstAddedLine: 1,
            },
          ],
        });
      }),
    );
  });

  describe("a caller whose environment names a different repository", () => {
    const comparedRepository = Effect.gen(function* comparedRepository() {
      const paths = yield* Path.Path;
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = false;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      return {
        repositoryRoot,
        comparison: yield* compareRevisions({
          repositoryRoot,
          baseRevision: "HEAD~1",
          headRevision: "HEAD",
        }).pipe(
          Effect.provide(Layer.fresh(gitEnvironmentLayer)),
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                GIT_DIR: paths.join(repositoryRoot, "absent.git"),
                GIT_WORK_TREE: paths.join(repositoryRoot, "absent"),
                HOME: repositoryRoot,
                PATH: yield* Config.String("PATH"),
              },
            }),
          ),
        ),
      };
    });

    it.effect("reads the repository it was named rather than the one the environment names", () =>
      Effect.gen(function* program() {
        const { comparison, repositoryRoot } = yield* comparedRepository;
        expect(comparison).toStrictEqual({
          repositoryRoot,
          baseRevision: "HEAD~1",
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

  describe("a base revision the repository does not carry", () => {
    const missingRevisionRefusal = Effect.gen(function* missingRevisionRefusal() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
      yield* git(repositoryRoot, ["add", "--all"]);
      yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
      const refusal = yield* Effect.flip(
        compareRevisions({
          repositoryRoot,
          baseRevision: "missing-revision",
          headRevision: "HEAD",
        }),
      );
      return refusal.message;
    });

    it.effect("refuses the comparison with the failed command", () =>
      Effect.gen(function* program() {
        expect(yield* missingRevisionRefusal).toContain(
          "rev-parse --verify --end-of-options missing-revision^{tree}\nfatal: Needed a single revision\n",
        );
      }),
    );
  });
});

describe("decodedSource", () => {
  describe("a blob with a source extension that does not decode as UTF-8", () => {
    const undecodableRefusal = Effect.flip(
      decodedSource("src/binary.ts", Uint8Array.from([0xff, 0xfe, 0xff])),
    );

    effectIt.effect("refuses the blob and names its path", () =>
      Effect.gen(function* program() {
        expect((yield* undecodableRefusal).message).toBe(
          "Source blob does not decode as UTF-8: src/binary.ts",
        );
      }),
    );
  });
});

describe("decodedPreviousSource", () => {
  describe("a blob that does not decode as UTF-8", () => {
    effectIt.effect("reads the blob as an absent source", () =>
      Effect.sync(() => {
        expect(decodedPreviousSource(Uint8Array.from([0xff, 0xfe, 0xff]))).toBe(null);
      }),
    );
  });
});
