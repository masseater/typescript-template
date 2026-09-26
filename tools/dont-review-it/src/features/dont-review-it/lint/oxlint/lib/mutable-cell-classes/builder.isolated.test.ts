import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { loadRepositoryCellClassIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const TALLY = `class Tally {
  total = 0;
  add(row: number) {
    this.total += row;
  }
}

const sum = (rows: readonly number[]): number => {
  const tally = new Tally();
  for (const row of rows) tally.add(row);
  return tally.total;
};

export const total = sum([1, 2]);
`;

layer(NodeServices.layer)("loadRepositoryCellClassIndex", (it) => {
  describe("a source holding a class standing in for a local variable", () => {
    const fixture = Effect.gen(function* cellClassIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "mutable-cell-classes-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "src", "a.ts"), TALLY);
      return loadRepositoryCellClassIndex({ repositoryRoot: root });
    });

    it.effect("is found at its own path", () =>
      Effect.gen(function* program() {
        const cellClassIndex = yield* fixture;
        expect(cellClassIndex).toStrictEqual({
          findingsByPath: new Map([
            ["src/a.ts", [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
          ]),
        });
      }),
    );
  });

  describe("a repository whose sources are all out of scope", () => {
    const fixture = Effect.gen(function* cellClassIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "mutable-cell-classes-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "src", "a.test.ts"), TALLY);
      return loadRepositoryCellClassIndex({ repositoryRoot: root });
    });

    it.effect("is indexed as empty", () =>
      Effect.gen(function* program() {
        const cellClassIndex = yield* fixture;
        expect(cellClassIndex).toStrictEqual({ findingsByPath: new Map() });
      }),
    );
  });

  describe("a repository holding no source at all", () => {
    const fixture = Effect.gen(function* cellClassIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "mutable-cell-classes-builder-",
      });

      yield* filesystem.writeFileString(paths.join(root, "notes.md"), "nothing to read\n");
      return loadRepositoryCellClassIndex({ repositoryRoot: root });
    });

    it.effect("is indexed as empty", () =>
      Effect.gen(function* program() {
        const cellClassIndex = yield* fixture;
        expect(cellClassIndex).toStrictEqual({ findingsByPath: new Map() });
      }),
    );
  });

  describe("the index of a repository", () => {
    const fixture = Effect.gen(function* sameIndexOnASecondAsk() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "mutable-cell-classes-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "src", "a.ts"), TALLY);
      return (
        loadRepositoryCellClassIndex({ repositoryRoot: root }) ===
        loadRepositoryCellClassIndex({ repositoryRoot: root })
      );
    });

    it.effect("is built once and handed back on every later ask", () =>
      Effect.gen(function* program() {
        const sameIndexOnASecondAsk = yield* fixture;
        expect(sameIndexOnASecondAsk).toBe(true);
      }),
    );
  });
});

describe("loadRepositoryCellClassIndex", () => {
  describe("a source that vanished after the listing", () => {
    const it = test.extend("cellClassIndex", () =>
      Effect.runPromise(
        Effect.gen(function* cellClassIndex() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({
            prefix: "mutable-cell-classes-builder-",
          });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(paths.join(root, "src", "vanished.ts"), TALLY);
          // mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether the source still exists between the listing and the read is settled inside the boundary this spec replaces
          vi.mocked(readTextFile).mockReturnValueOnce(null);
          return loadRepositoryCellClassIndex({ repositoryRoot: root });
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
      ));

    it("is left out of the index", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({ findingsByPath: new Map() });
    });
  });
});
