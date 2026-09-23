// @effect-diagnostics-next-line nodeBuiltinImport:off
import { readFileSync } from "node:fs";

import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { buildRepositoryBodyIndex, loadRepositoryBodyIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const VANISHED_FILE_NAME = "vanished.ts";

const TWICE = `export const twice = (value: number): number => {
  const doubled = value * 2;
  return doubled;
};
`;

layer(NodeServices.layer)("buildRepositoryBodyIndex", (it) => {
  describe("a body spelled in two files of a repository", () => {
    const fixture = Effect.gen(function* indexedPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "duplicated-bodies-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.ts"), TWICE);
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "b.ts"), TWICE);
      return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
    });

    it.effect("places both of those files in the index", () =>
      Effect.gen(function* program() {
        const indexedPaths = yield* fixture;
        expect(indexedPaths).toStrictEqual(["src/a.ts", "src/b.ts"]);
      }),
    );
  });

  describe("a repository whose sources are all out of scope", () => {
    const fixture = Effect.gen(function* indexedPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "duplicated-bodies-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.test.ts"), TWICE);
      return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
    });

    it.effect("is indexed as empty", () =>
      Effect.gen(function* program() {
        const indexedPaths = yield* fixture;
        expect(indexedPaths).toStrictEqual([]);
      }),
    );
  });

  describe("a repository holding a source that declares no body of its own", () => {
    const fixture = Effect.gen(function* indexedPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "duplicated-bodies-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.ts"), TWICE);
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "b.ts"), "export {};\n");
      return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
    });

    it.effect("leaves that source out of the index", () =>
      Effect.gen(function* program() {
        const indexedPaths = yield* fixture;
        expect(indexedPaths).toStrictEqual(["src/a.ts"]);
      }),
    );
  });

  describe("a repository holding a source that vanished after the listing", () => {
    const fixture = Effect.gen(function* indexedPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "duplicated-bodies-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.ts"), TWICE);
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", VANISHED_FILE_NAME),
        TWICE,
      );
      // mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether a listed source is still readable is settled by the file system between the listing and the read, and that window is inside the boundary this spec replaces
      vi.mocked(readTextFile).mockImplementation((path) =>
        path.endsWith(VANISHED_FILE_NAME) ? null : readFileSync(path, "utf8"),
      );
      return Array.from(buildRepositoryBodyIndex({ repositoryRoot }).bodiesByPath.keys());
    });

    it.effect("leaves that source out of the index", () =>
      Effect.gen(function* program() {
        const indexedPaths = yield* fixture;
        expect(indexedPaths).toStrictEqual(["src/a.ts"]);
      }),
    );
  });
});

layer(NodeServices.layer)("loadRepositoryBodyIndex", (it) => {
  describe("a repository asked for its index a second time", () => {
    const fixture = Effect.gen(function* sameIndexHandedBack() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "duplicated-bodies-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.ts"), TWICE);
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "b.ts"), TWICE);
      return (
        loadRepositoryBodyIndex({ repositoryRoot }) === loadRepositoryBodyIndex({ repositoryRoot })
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
