import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  childDirectoryNamesIn,
  directoryEntries,
  filesUnder,
  type TreeFailure,
} from "./directory-entries.ts";

const linkedTree = Effect.gen(function* linkedTree() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "directory-entries-" });
  const outside = yield* filesystem.makeTempDirectoryScoped({ prefix: "directory-entries-out-" });
  yield* filesystem.writeFileString(paths.join(outside, "reached.ts"), "held");
  yield* filesystem.writeFileString(paths.join(root, "zeta.ts"), "held");
  yield* filesystem.writeFileString(paths.join(root, "alpha.ts"), "held");
  yield* filesystem.makeDirectory(paths.join(root, "nested"));
  yield* filesystem.writeFileString(paths.join(root, "nested", "inner.ts"), "held");
  yield* filesystem.makeDirectory(paths.join(root, "node_modules"));
  yield* filesystem.writeFileString(paths.join(root, "node_modules", "vendored.ts"), "held");
  yield* filesystem.symlink(outside, paths.join(root, "to-outside"));
  yield* filesystem.symlink(paths.join(outside, "reached.ts"), paths.join(root, "to-file.ts"));
  return { root, paths };
});

const withDanglingLink = Effect.gen(function* withDanglingLink() {
  const filesystem = yield* FileSystem.FileSystem;
  const { root, paths } = yield* linkedTree;
  yield* filesystem.symlink(paths.join(root, "missing"), paths.join(root, "nested", "dangling"));
  return { root, paths };
});

const danglingPathOf = (failure: TreeFailure) =>
  failure._tag === "DanglingSymlink" ? { _tag: failure._tag, path: failure.path } : failure;

layer(NodeServices.layer)("directory entries", (it) => {
  describe("a directory holding files, a directory, and symlinks", () => {
    it.effect("names each entry by what it is without following a symlink, in name order", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "directory-entries-" });
        yield* filesystem.writeFileString(paths.join(root, "file.txt"), "held");
        yield* filesystem.makeDirectory(paths.join(root, "directory"));
        yield* filesystem.symlink(paths.join(root, "directory"), paths.join(root, "to-directory"));
        yield* filesystem.symlink(paths.join(root, "file.txt"), paths.join(root, "to-file"));
        yield* filesystem.symlink(paths.join(root, "missing"), paths.join(root, "dangling"));

        expect(yield* directoryEntries(root)).toStrictEqual([
          { kind: "dangling-symlink", name: "dangling" },
          { kind: "directory", name: "directory" },
          { kind: "file", name: "file.txt" },
          { kind: "symlink", name: "to-directory" },
          { kind: "symlink", name: "to-file" },
        ]);
      }),
    );
  });

  describe("a walk below a tree with a pruned directory and symlinks", () => {
    it.effect("keeps the plain files in path order, pruning and never following a symlink", () =>
      Effect.gen(function* program() {
        const { root, paths } = yield* linkedTree;
        expect(
          yield* filesUnder({
            directory: root,
            prunedDirectoryNames: ["node_modules"],
            keepsFileName: (fileName) => fileName.endsWith(".ts"),
          }),
        ).toStrictEqual([
          paths.join(root, "alpha.ts"),
          paths.join(root, "nested", "inner.ts"),
          paths.join(root, "zeta.ts"),
        ]);
      }),
    );
  });

  describe("a walk below a directory that is not there", () => {
    it.effect("tells the caller the root is absent", () =>
      Effect.gen(function* program() {
        const { root, paths } = yield* linkedTree;
        expect(
          yield* filesUnder({
            directory: paths.join(root, "absent"),
            prunedDirectoryNames: [],
            keepsFileName: () => true,
          }),
        ).toBe(null);
      }),
    );
  });

  describe("a walk that meets a symlink to nothing", () => {
    it.effect("fails naming the link", () =>
      Effect.gen(function* program() {
        const { root, paths } = yield* withDanglingLink;
        const failure = yield* Effect.flip(
          filesUnder({ directory: root, prunedDirectoryNames: [], keepsFileName: () => true }),
        );
        expect(danglingPathOf(failure)).toStrictEqual({
          _tag: "DanglingSymlink",
          path: paths.join(root, "nested", "dangling"),
        });
      }),
    );
  });

  describe("the child directories of a parent holding a symlinked directory", () => {
    it.effect("names only the directories that sit there, in name order", () =>
      Effect.gen(function* program() {
        const { root } = yield* linkedTree;
        expect(yield* childDirectoryNamesIn(root)).toStrictEqual(["nested", "node_modules"]);
      }),
    );
  });

  describe("the child directories of a parent that is not there", () => {
    it.effect("tells the caller the parent is absent", () =>
      Effect.gen(function* program() {
        const { root, paths } = yield* linkedTree;
        expect(yield* childDirectoryNamesIn(paths.join(root, "absent"))).toBe(null);
      }),
    );
  });

  describe("the child directories of a parent holding a symlink to nothing", () => {
    it.effect("fails naming the link", () =>
      Effect.gen(function* program() {
        const { root, paths } = yield* withDanglingLink;
        const failure = yield* Effect.flip(childDirectoryNamesIn(paths.join(root, "nested")));
        expect(danglingPathOf(failure)).toStrictEqual({
          _tag: "DanglingSymlink",
          path: paths.join(root, "nested", "dangling"),
        });
      }),
    );
  });
});
