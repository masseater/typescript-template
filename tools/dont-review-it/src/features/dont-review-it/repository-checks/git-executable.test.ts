import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { searchPathDelimiter } from "../platform/path.ts";
import { gitExecutablePath } from "./git-executable.ts";

const RUNNABLE = 0o755;

const UNRUNNABLE = 0o644;

const directoryCarrying = (
  prefix: string,
  carried: { readonly fileName: string; readonly mode: number } | null,
) =>
  Effect.gen(function* directoryCarrying() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const directory = yield* filesystem.makeTempDirectoryScoped({ prefix });
    if (carried !== null) {
      const carriedFile = paths.join(directory, carried.fileName);
      yield* filesystem.writeFileString(carriedFile, "");
      yield* filesystem.chmod(carriedFile, carried.mode);
    }
    return directory;
  });

layer(NodeServices.layer)("gitExecutablePath", (it) => {
  describe("a search path whose later directory carries an executable git", () => {
    const fixture = Effect.gen(function* gitPathAcrossDirectories() {
      const paths = yield* Path.Path;
      const leadingEmptyDirectory = yield* directoryCarrying("git-executable-leading-empty-", null);
      const trailingGitDirectory = yield* directoryCarrying("git-executable-trailing-git-", {
        fileName: "git",
        mode: RUNNABLE,
      });
      return {
        expected: paths.join(trailingGitDirectory, "git"),
        located: gitExecutablePath(
          [leadingEmptyDirectory, trailingGitDirectory].join(searchPathDelimiter),
        ),
      };
    });

    it.effect("answers with the git of the earliest directory carrying one", () =>
      Effect.gen(function* program() {
        const { expected, located } = yield* fixture;
        expect(located).toBe(expected);
      }),
    );
  });

  describe("a directory carrying a windows executable and no plain name", () => {
    const fixture = Effect.gen(function* windowsGitPath() {
      const paths = yield* Path.Path;
      const windowsGitDirectory = yield* directoryCarrying("git-executable-windows-git-", {
        fileName: "git.exe",
        mode: RUNNABLE,
      });
      return {
        expected: paths.join(windowsGitDirectory, "git.exe"),
        located: gitExecutablePath(windowsGitDirectory),
      };
    });

    it.effect("answers with the windows executable", () =>
      Effect.gen(function* program() {
        const { expected, located } = yield* fixture;
        expect(located).toBe(expected);
      }),
    );
  });

  describe("a directory carrying a git file that cannot be executed", () => {
    const fixture = Effect.gen(function* unrunnableGitPath() {
      const unrunnableGitDirectory = yield* directoryCarrying("git-executable-unrunnable-git-", {
        fileName: "git",
        mode: UNRUNNABLE,
      });
      return gitExecutablePath(unrunnableGitDirectory);
    });

    it.effect("leaves the plain name to the operating system", () =>
      Effect.gen(function* program() {
        const unrunnableGitPath = yield* fixture;
        expect(unrunnableGitPath).toBe("git");
      }),
    );
  });

  describe("a search path carrying nothing", () => {
    const fixture = Effect.gen(function* gitPathWithoutCandidates() {
      const nothingCarriedDirectory = yield* directoryCarrying(
        "git-executable-nothing-carried-",
        null,
      );
      return gitExecutablePath(nothingCarriedDirectory);
    });

    it.effect("leaves the plain name to the operating system", () =>
      Effect.gen(function* program() {
        const gitPathWithoutCandidates = yield* fixture;
        expect(gitPathWithoutCandidates).toBe("git");
      }),
    );
  });

  describe("an absent search path", () => {
    it.effect("leaves the plain name to the operating system", () =>
      Effect.sync(() => {
        expect(gitExecutablePath(undefined)).toBe("git");
      }),
    );
  });

  describe("a search path handed over a second time after its git file went away", () => {
    const fixture = Effect.gen(function* gitPathFromRepeatedSearch() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repeatedSearchDirectory = yield* directoryCarrying("git-executable-repeated-search-", {
        fileName: "git",
        mode: RUNNABLE,
      });
      const gitFile = paths.join(repeatedSearchDirectory, "git");
      gitExecutablePath(repeatedSearchDirectory);
      yield* filesystem.remove(gitFile);
      return { expected: gitFile, located: gitExecutablePath(repeatedSearchDirectory) };
    });

    it.effect("answers with what the first search located", () =>
      Effect.gen(function* program() {
        const { expected, located } = yield* fixture;
        expect(located).toBe(expected);
      }),
    );
  });
});
