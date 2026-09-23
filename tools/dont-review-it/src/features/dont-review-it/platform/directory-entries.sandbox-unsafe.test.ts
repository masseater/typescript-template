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

const scratchTree = Effect.gen(function* scratchTree() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "directory-entries-" });
  const outside = yield* filesystem.makeTempDirectoryScoped({ prefix: "directory-entries-out-" });
  yield* filesystem.writeFileString(paths.join(outside, "reached.ts"), "held");
  return {
    filesystem,
    paths,
    root,
    outside,
    realRoot: yield* filesystem.realPath(root),
    realOutside: yield* filesystem.realPath(outside),
  };
});

const shapeOf = (failure: TreeFailure) => {
  switch (failure._tag) {
    case "DanglingSymlink":
      return { _tag: failure._tag, path: failure.path };
    case "EscapingSymlink":
      return { _tag: failure._tag, path: failure.path, target: failure.target, root: failure.root };
    case "SymlinkCycle":
      return { _tag: failure._tag, path: failure.path, target: failure.target };
    case "PlatformError":
      return failure;
  }
};

const everyFileUnder = (directory: string) =>
  filesUnder({ directory, prunedDirectoryNames: [], keepsFileName: () => true });

layer(NodeServices.layer)("directory entries", (it) => {
  describe("a directory holding files, a directory, and symlinks that stay inside it", () => {
    it.effect("names each entry by what it reaches, in name order", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root } = yield* scratchTree;
        yield* filesystem.writeFileString(paths.join(root, "file.txt"), "held");
        yield* filesystem.makeDirectory(paths.join(root, "directory"));
        yield* filesystem.symlink(paths.join(root, "directory"), paths.join(root, "to-directory"));
        yield* filesystem.symlink("file.txt", paths.join(root, "to-file"));

        expect(yield* directoryEntries(root)).toStrictEqual([
          { kind: "directory", name: "directory" },
          { kind: "file", name: "file.txt" },
          { kind: "directory", name: "to-directory" },
          { kind: "file", name: "to-file" },
        ]);
      }),
    );
  });

  describe("a directory holding a symlink that leaves it", () => {
    it.effect("fails naming the link and where it leads", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root, outside, realOutside } = yield* scratchTree;
        yield* filesystem.symlink(outside, paths.join(root, "away"));

        const failure = yield* Effect.flip(directoryEntries(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "EscapingSymlink",
          path: paths.join(root, "away"),
          target: realOutside,
          root,
        });
      }),
    );
  });

  describe("a directory holding a symlink to nothing", () => {
    it.effect("fails naming the link", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root } = yield* scratchTree;
        yield* filesystem.symlink(paths.join(root, "missing"), paths.join(root, "dangling"));

        const failure = yield* Effect.flip(directoryEntries(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "DanglingSymlink",
          path: paths.join(root, "dangling"),
        });
      }),
    );
  });

  describe("a walk below a tree with a pruned directory and symlinks that stay inside it", () => {
    it.effect("keeps the files reached through the links under the link path, in path order", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root, outside } = yield* scratchTree;
        yield* filesystem.writeFileString(paths.join(root, "zeta.ts"), "held");
        yield* filesystem.writeFileString(paths.join(root, "alpha.ts"), "held");
        yield* filesystem.makeDirectory(paths.join(root, "nested"));
        yield* filesystem.writeFileString(paths.join(root, "nested", "inner.ts"), "held");
        yield* filesystem.makeDirectory(paths.join(root, "node_modules"));
        yield* filesystem.writeFileString(paths.join(root, "node_modules", "vendored.ts"), "held");
        yield* filesystem.symlink(outside, paths.join(root, "node_modules", "outside"));
        yield* filesystem.symlink(paths.join(root, "nested"), paths.join(root, "to-nested"));
        yield* filesystem.symlink("alpha.ts", paths.join(root, "to-alpha.ts"));
        yield* filesystem.symlink(paths.join(outside, "reached.ts"), paths.join(root, "notes.md"));

        expect(
          yield* filesUnder({
            directory: root,
            prunedDirectoryNames: ["node_modules"],
            keepsFileName: (fileName) => fileName.endsWith(".ts"),
          }),
        ).toStrictEqual([
          paths.join(root, "alpha.ts"),
          paths.join(root, "nested", "inner.ts"),
          paths.join(root, "to-alpha.ts"),
          paths.join(root, "to-nested", "inner.ts"),
          paths.join(root, "zeta.ts"),
        ]);
      }),
    );
  });

  describe("a walk that keeps a file whose symlink leaves the tree", () => {
    it.effect("fails naming the link and where it leads", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root, outside, realOutside } = yield* scratchTree;
        yield* filesystem.makeDirectory(paths.join(root, "nested"));
        yield* filesystem.symlink(
          paths.join(outside, "reached.ts"),
          paths.join(root, "nested", "linked.ts"),
        );

        const failure = yield* Effect.flip(everyFileUnder(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "EscapingSymlink",
          path: paths.join(root, "nested", "linked.ts"),
          target: paths.join(realOutside, "reached.ts"),
          root,
        });
      }),
    );
  });

  describe("a walk that meets a directory whose symlink leaves the tree", () => {
    it.effect("fails naming the link and where it leads", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root, outside, realOutside } = yield* scratchTree;
        yield* filesystem.symlink(outside, paths.join(root, "away"));

        const failure = yield* Effect.flip(everyFileUnder(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "EscapingSymlink",
          path: paths.join(root, "away"),
          target: realOutside,
          root,
        });
      }),
    );
  });

  describe("a walk that meets a symlink back to the directory enclosing it", () => {
    it.effect("fails naming the link and the directory it would re-enter", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root, realRoot } = yield* scratchTree;
        yield* filesystem.makeDirectory(paths.join(root, "nested"));
        yield* filesystem.symlink(root, paths.join(root, "nested", "back"));

        const failure = yield* Effect.flip(everyFileUnder(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "SymlinkCycle",
          path: paths.join(root, "nested", "back"),
          target: realRoot,
        });
      }),
    );
  });

  describe("a walk through two directories whose symlinks point at each other", () => {
    it.effect("fails where the first link chain comes back to a directory it is inside", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root, realRoot } = yield* scratchTree;
        yield* filesystem.makeDirectory(paths.join(root, "x"));
        yield* filesystem.makeDirectory(paths.join(root, "y"));
        yield* filesystem.symlink(paths.join(root, "y"), paths.join(root, "x", "to-y"));
        yield* filesystem.symlink(paths.join(root, "x"), paths.join(root, "y", "to-x"));

        const failure = yield* Effect.flip(everyFileUnder(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "SymlinkCycle",
          path: paths.join(root, "x", "to-y", "to-x"),
          target: paths.join(realRoot, "x"),
        });
      }),
    );
  });

  describe("a walk that meets a symlink to itself", () => {
    it.effect("fails naming the link and what it spells", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root } = yield* scratchTree;
        yield* filesystem.symlink("loop", paths.join(root, "loop"));

        const failure = yield* Effect.flip(everyFileUnder(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "SymlinkCycle",
          path: paths.join(root, "loop"),
          target: "loop",
        });
      }),
    );
  });

  describe("a walk that meets a symlink to nothing", () => {
    it.effect("fails naming the link", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root } = yield* scratchTree;
        yield* filesystem.makeDirectory(paths.join(root, "nested"));
        yield* filesystem.symlink(
          paths.join(root, "missing"),
          paths.join(root, "nested", "dangling"),
        );

        const failure = yield* Effect.flip(everyFileUnder(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "DanglingSymlink",
          path: paths.join(root, "nested", "dangling"),
        });
      }),
    );
  });

  describe("a walk below a directory that is not there", () => {
    it.effect("tells the caller the root is absent", () =>
      Effect.gen(function* program() {
        const { paths, root } = yield* scratchTree;
        expect(yield* everyFileUnder(paths.join(root, "absent"))).toBe(null);
      }),
    );
  });

  describe("the child directories of a parent holding symlinks that stay inside it", () => {
    it.effect("names the directories reached directly or through a link, in name order", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root, outside } = yield* scratchTree;
        yield* filesystem.makeDirectory(paths.join(root, "nested"));
        yield* filesystem.makeDirectory(paths.join(root, "node_modules"));
        yield* filesystem.writeFileString(paths.join(root, "loose.ts"), "held");
        yield* filesystem.symlink(paths.join(root, "nested"), paths.join(root, "to-nested"));
        yield* filesystem.symlink(paths.join(outside, "reached.ts"), paths.join(root, "notes.md"));

        expect(yield* childDirectoryNamesIn(root)).toStrictEqual([
          "nested",
          "node_modules",
          "to-nested",
        ]);
      }),
    );
  });

  describe("the child directories of a parent holding a directory symlink that leaves it", () => {
    it.effect("fails naming the link and where it leads", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root, outside, realOutside } = yield* scratchTree;
        yield* filesystem.symlink(outside, paths.join(root, "away"));

        const failure = yield* Effect.flip(childDirectoryNamesIn(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "EscapingSymlink",
          path: paths.join(root, "away"),
          target: realOutside,
          root,
        });
      }),
    );
  });

  describe("the child directories of a parent that is not there", () => {
    it.effect("tells the caller the parent is absent", () =>
      Effect.gen(function* program() {
        const { paths, root } = yield* scratchTree;
        expect(yield* childDirectoryNamesIn(paths.join(root, "absent"))).toBe(null);
      }),
    );
  });

  describe("the child directories of a parent holding a symlink to nothing", () => {
    it.effect("fails naming the link", () =>
      Effect.gen(function* program() {
        const { filesystem, paths, root } = yield* scratchTree;
        yield* filesystem.symlink(paths.join(root, "missing"), paths.join(root, "dangling"));

        const failure = yield* Effect.flip(childDirectoryNamesIn(root));
        expect(shapeOf(failure)).toStrictEqual({
          _tag: "DanglingSymlink",
          path: paths.join(root, "dangling"),
        });
      }),
    );
  });
});
