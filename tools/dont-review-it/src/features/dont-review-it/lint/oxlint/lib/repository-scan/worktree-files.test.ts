import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { gitOutput } from "../git-output.ts";
import {
  UNSCANNED_DIRECTORY_NAMES,
  unscannedDirectoryNamesFrom,
  worktreeFilePathsUnder,
} from "./worktree-files.ts";

layer(NodeServices.layer)("worktreeFilePathsUnder", (it) => {
  describe("a worktree holding files at the root and under nested directories", () => {
    const fixture = Effect.gen(function* paths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "worktree-files-" });

      yield* filesystem.makeDirectory(pathService.join(root, "packages", "alpha"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(root, "packages", "alpha", "package.json"),
        "held\n",
      );
      yield* filesystem.writeFileString(pathService.join(root, "README.md"), "held\n");
      return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    });

    it.effect("lists every file as a repository relative path", () =>
      Effect.gen(function* program() {
        const paths = yield* fixture;
        expect(paths).toStrictEqual(["README.md", "packages/alpha/package.json"]);
      }),
    );
  });

  describe("a worktree holding a directory git ignores", () => {
    const fixture = Effect.gen(function* paths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "worktree-files-" });

      gitOutput(["init", "--quiet"], { cwd: root, env: process.env });
      yield* filesystem.writeFileString(pathService.join(root, ".gitignore"), ".local/\n");
      yield* filesystem.makeDirectory(pathService.join(root, ".local", "source-maps"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(root, ".local", "source-maps", "entry.js.map"),
        "held\n",
      );
      yield* filesystem.writeFileString(pathService.join(root, "entry.ts"), "held\n");
      return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    });

    it.effect("keeps only the files git would track", () =>
      Effect.gen(function* program() {
        const paths = yield* fixture;
        expect(paths).toStrictEqual([".gitignore", "entry.ts"]);
      }),
    );
  });

  describe("a worktree holding directories named as unscanned", () => {
    const fixture = Effect.gen(function* paths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "worktree-files-" });

      yield* filesystem.makeDirectory(pathService.join(root, "node_modules", "left-pad"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(root, "node_modules", "left-pad", "index.js"),
        "held\n",
      );
      yield* filesystem.makeDirectory(pathService.join(root, "dist"), { recursive: true });
      yield* filesystem.writeFileString(pathService.join(root, "dist", "bundle.js"), "held\n");
      yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(pathService.join(root, "src", "entry.ts"), "held\n");
      return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    });

    it.effect("walks past each of them and keeps what stands beside them", () =>
      Effect.gen(function* program() {
        const paths = yield* fixture;
        expect(paths).toStrictEqual(["src/entry.ts"]);
      }),
    );
  });

  describe("a worktree holding a symbolic link beside a file", () => {
    const fixture = Effect.gen(function* paths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "worktree-files-" });

      const linkedFilePath = pathService.join(root, "src", "entry.ts");
      yield* filesystem.makeDirectory(pathService.dirname(linkedFilePath), { recursive: true });
      yield* filesystem.writeFileString(linkedFilePath, "held\n");
      yield* filesystem.symlink(linkedFilePath, pathService.join(root, "link.ts"));
      return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    });

    it.effect("leaves out the entry that is neither a file nor a directory", () =>
      Effect.gen(function* program() {
        const paths = yield* fixture;
        expect(paths).toStrictEqual(["src/entry.ts"]);
      }),
    );
  });

  describe("a root that does not exist", () => {
    const fixture = Effect.gen(function* paths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "worktree-files-" });

      return worktreeFilePathsUnder({
        root: pathService.join(root, "absent"),
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("holds no files", () =>
      Effect.gen(function* program() {
        const paths = yield* fixture;
        expect(paths).toStrictEqual([]);
      }),
    );
  });

  describe("a worktree asked again after a later file appeared", () => {
    const fixture = Effect.gen(function* paths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "worktree-files-" });

      yield* filesystem.makeDirectory(pathService.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(pathService.join(root, "src", "entry.ts"), "held\n");
      worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
      yield* filesystem.writeFileString(pathService.join(root, "src", "later.ts"), "held\n");
      return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    });

    it.effect("is walked once and answered from what was walked", () =>
      Effect.gen(function* program() {
        const paths = yield* fixture;
        expect(paths).toStrictEqual(["src/entry.ts"]);
      }),
    );
  });
});

describe("unscannedDirectoryNamesFrom", () => {
  describe("options nobody wrote", () => {
    const it = test.extend("unscannedDirectoryNames", () => unscannedDirectoryNamesFrom([]));

    it("leaves the declared list standing", ({ unscannedDirectoryNames }) => {
      expect(unscannedDirectoryNames).toBe(UNSCANNED_DIRECTORY_NAMES);
    });
  });

  describe("options that name no unscanned directories", () => {
    const it = test.extend("unscannedDirectoryNames", () => unscannedDirectoryNamesFrom([{}]));

    it("leaves the declared list standing", ({ unscannedDirectoryNames }) => {
      expect(unscannedDirectoryNames).toBe(UNSCANNED_DIRECTORY_NAMES);
    });
  });

  describe("options that name unscanned directories", () => {
    const it = test.extend("unscannedDirectoryNames", () =>
      unscannedDirectoryNamesFrom([{ unscannedDirectories: ["vendor"] }]));

    it("replaces the declared list", ({ unscannedDirectoryNames }) => {
      expect(unscannedDirectoryNames).toStrictEqual(new Set(["vendor"]));
    });
  });
});
