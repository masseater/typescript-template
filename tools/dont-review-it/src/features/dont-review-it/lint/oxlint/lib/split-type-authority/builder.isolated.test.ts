import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { loadRepositoryTypeAuthorityIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const SHAPE =
  "export type Shape = { readonly a: string; readonly b: number; readonly c: Named };\n";

layer(NodeServices.layer)("loadRepositoryTypeAuthorityIndex", (it) => {
  describe("a repository holding one source that declares an exported type", () => {
    const fixture = Effect.gen(function* indexedPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "split-type-authority-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "src", "a.ts"), SHAPE);
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it.effect("places that source in the index", () =>
      Effect.gen(function* program() {
        const indexedPaths = yield* fixture;
        expect(indexedPaths).toStrictEqual(["src/a.ts"]);
      }),
    );
  });

  describe("a repository holding a source that declares no exported type", () => {
    const fixture = Effect.gen(function* indexedPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "split-type-authority-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "src", "a.ts"), SHAPE);
      yield* filesystem.writeFileString(paths.join(root, "src", "b.ts"), "export {};\n");
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it.effect("leaves that source out of the index", () =>
      Effect.gen(function* program() {
        const indexedPaths = yield* fixture;
        expect(indexedPaths).toStrictEqual(["src/a.ts"]);
      }),
    );
  });

  describe("a repository holding only a test file", () => {
    const fixture = Effect.gen(function* indexedPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "split-type-authority-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "src", "a.test.ts"), SHAPE);
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it.effect("leaves the test file out of the index", () =>
      Effect.gen(function* program() {
        const indexedPaths = yield* fixture;
        expect(indexedPaths).toStrictEqual([]);
      }),
    );
  });

  describe("a repository holding no source at all", () => {
    const fixture = Effect.gen(function* indexedPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "split-type-authority-builder-",
      });

      yield* filesystem.writeFileString(paths.join(root, "README.md"), "# held\n");
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it.effect("is indexed as empty", () =>
      Effect.gen(function* program() {
        const indexedPaths = yield* fixture;
        expect(indexedPaths).toStrictEqual([]);
      }),
    );
  });

  describe("a repository holding a source that cannot be read", () => {
    const fixture = Effect.gen(function* indexedPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "split-type-authority-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "src", "a-unreadable.ts"), SHAPE);
      yield* filesystem.writeFileString(paths.join(root, "src", "b-present.ts"), SHAPE);
      // mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether a source that the scan already found can still be opened is settled by the file system inside the boundary this spec replaces, and every source this spec can write is readable
      vi.mocked(readTextFile).mockReturnValueOnce(null);
      return Array.from(
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }).typesByPath.keys(),
      );
    });

    it.effect("leaves that source out of the index", () =>
      Effect.gen(function* program() {
        const indexedPaths = yield* fixture;
        expect(indexedPaths).toStrictEqual(["src/b-present.ts"]);
      }),
    );
  });

  describe("a type standing beside a manifest", () => {
    const fixture = Effect.gen(function* workspacePaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "split-type-authority-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "packages", "order", "src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "order", "package.json"),
        "{}",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "order", "src", "a.ts"),
        SHAPE,
      );
      return loadRepositoryTypeAuthorityIndex({ repositoryRoot: root })
        .typesByPath.get("packages/order/src/a.ts")
        ?.map((indexed) => indexed.workspacePath);
    });

    it.effect("is placed in the workspace whose manifest stands nearest to it", () =>
      Effect.gen(function* program() {
        const workspacePaths = yield* fixture;
        expect(workspacePaths).toStrictEqual(["packages/order"]);
      }),
    );
  });

  describe("a type standing under no manifest at all", () => {
    const fixture = Effect.gen(function* workspacePaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "split-type-authority-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "src", "a.ts"), SHAPE);
      return loadRepositoryTypeAuthorityIndex({ repositoryRoot: root })
        .typesByPath.get("src/a.ts")
        ?.map((indexed) => indexed.workspacePath);
    });

    it.effect("belongs to the repository root", () =>
      Effect.gen(function* program() {
        const workspacePaths = yield* fixture;
        expect(workspacePaths).toStrictEqual([""]);
      }),
    );
  });

  describe("a repository asked for its index a second time", () => {
    const fixture = Effect.gen(function* sameIndexHandedBack() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "split-type-authority-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "src", "a.ts"), SHAPE);
      return (
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root }) ===
        loadRepositoryTypeAuthorityIndex({ repositoryRoot: root })
      );
    });

    it.effect("is handed the index built on the first ask", () =>
      Effect.gen(function* program() {
        const sameIndexHandedBack = yield* fixture;
        expect(sameIndexHandedBack).toBe(true);
      }),
    );
  });
});
