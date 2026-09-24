import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import { readTextFile } from "../canonical-values/source-files.ts";
import { loadRepositoryValueDeclarationIndex } from "./builder.ts";

vi.mock(import("../canonical-values/source-files.ts"), { spy: true });

const SEED = `export const seed = 1;\n`;

const REMOVED_FILE_NAME = "removed.ts";

const SEED_FINGERPRINT = '{annotation:null,init:{type:"Literal",value:1,raw:"1"}}';

layer(NodeServices.layer)("loadRepositoryValueDeclarationIndex", (it) => {
  describe("a repository holding two sources that declare the same value", () => {
    const fixture = Effect.gen(function* indexOfTwoSourcesDeclaringValues() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "value-declarations-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.ts"), SEED);
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "b.ts"), SEED);
      return loadRepositoryValueDeclarationIndex({ repositoryRoot });
    });

    it.effect("takes in every source that declares a value", () =>
      Effect.gen(function* program() {
        const indexOfTwoSourcesDeclaringValues = yield* fixture;
        expect(indexOfTwoSourcesDeclaringValues).toStrictEqual({
          sitesByName: new Map([
            [
              "seed",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/b.ts",
                },
              ],
            ],
          ]),
          sitesByPath: new Map([
            [
              "src/a.ts",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
              ],
            ],
            [
              "src/b.ts",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/b.ts",
                },
              ],
            ],
          ]),
        });
      }),
    );

    it.effect("names the two places a copied value stands", () =>
      Effect.gen(function* program() {
        const indexOfTwoSourcesDeclaringValues = yield* fixture;
        expect(indexOfTwoSourcesDeclaringValues).toStrictEqual({
          sitesByName: new Map([
            [
              "seed",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/b.ts",
                },
              ],
            ],
          ]),
          sitesByPath: new Map([
            [
              "src/a.ts",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
              ],
            ],
            [
              "src/b.ts",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/b.ts",
                },
              ],
            ],
          ]),
        });
      }),
    );
  });

  describe("a repository holding a source beside a test file", () => {
    const fixture = Effect.gen(function* indexOfASourceBesideATestFile() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "value-declarations-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.ts"), SEED);
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.test.ts"), SEED);
      return loadRepositoryValueDeclarationIndex({ repositoryRoot });
    });

    it.effect("leaves a test file out of the index", () =>
      Effect.gen(function* program() {
        const indexOfASourceBesideATestFile = yield* fixture;
        expect(indexOfASourceBesideATestFile).toStrictEqual({
          sitesByName: new Map([
            [
              "seed",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
              ],
            ],
          ]),
          sitesByPath: new Map([
            [
              "src/a.ts",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
              ],
            ],
          ]),
        });
      }),
    );
  });

  describe("a repository holding a source that declares no value of its own", () => {
    const fixture = Effect.gen(function* indexOfASourceBesideAValuelessSource() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "value-declarations-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.ts"), SEED);
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "b.ts"), "export {};\n");
      return loadRepositoryValueDeclarationIndex({ repositoryRoot });
    });

    it.effect("leaves a source that declares no value of its own out of the index", () =>
      Effect.gen(function* program() {
        const indexOfASourceBesideAValuelessSource = yield* fixture;
        expect(indexOfASourceBesideAValuelessSource).toStrictEqual({
          sitesByName: new Map([
            [
              "seed",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
              ],
            ],
          ]),
          sitesByPath: new Map([
            [
              "src/a.ts",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
              ],
            ],
          ]),
        });
      }),
    );
  });

  describe("a repository holding a source that went away after the listing", () => {
    const fixture = Effect.gen(function* indexOfASourceBesideAVanishedSource() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "value-declarations-builder-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.ts"), SEED);
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", REMOVED_FILE_NAME), SEED);
      const listedSources = yield* Effect.promise(() =>
        vi.importActual<typeof import("../canonical-values/source-files.ts")>(
          "../canonical-values/source-files.ts",
        ),
      );
      // mock-factory-exemption no-replaced-double-behaviour--let-the-replaced-module-answer -- whether a listed source is still there by the time it is read is settled inside the boundary this spec replaces, and both the listing and the read happen inside one synchronous call
      vi.mocked(readTextFile).mockImplementation((path) =>
        path.endsWith(REMOVED_FILE_NAME) ? null : listedSources.readTextFile(path),
      );
      return loadRepositoryValueDeclarationIndex({ repositoryRoot });
    });

    it.effect("leaves a source that went away after the listing out of the index", () =>
      Effect.gen(function* program() {
        const indexOfASourceBesideAVanishedSource = yield* fixture;
        expect(indexOfASourceBesideAVanishedSource).toStrictEqual({
          sitesByName: new Map([
            [
              "seed",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
              ],
            ],
          ]),
          sitesByPath: new Map([
            [
              "src/a.ts",
              [
                {
                  name: "seed",
                  line: 1,
                  exported: true,
                  fingerprint: SEED_FINGERPRINT,
                  relativePath: "src/a.ts",
                },
              ],
            ],
          ]),
        });
      }),
    );
  });

  describe("a repository asked for its index a second time", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const repositoryRootHoldingOneSource = yield* Effect.gen(
        function* repositoryRootHoldingOneSource() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "value-declarations-builder-",
          });

          const sourceFilePath = paths.join(repositoryRoot, "src", "a.ts");
          yield* filesystem.makeDirectory(paths.dirname(sourceFilePath), { recursive: true });
          yield* filesystem.writeFileString(sourceFilePath, SEED);
          return repositoryRoot;
        },
      );
      const indexBuiltFirst = loadRepositoryValueDeclarationIndex({
        repositoryRoot: repositoryRootHoldingOneSource,
      });
      const indexBuiltAgain = loadRepositoryValueDeclarationIndex({
        repositoryRoot: repositoryRootHoldingOneSource,
      });
      return { repositoryRootHoldingOneSource, indexBuiltFirst, indexBuiltAgain };
    });

    it.effect("builds the index of a repository once and hands the same one back later", () =>
      Effect.gen(function* program() {
        const { indexBuiltAgain, indexBuiltFirst } = yield* fixtures;
        expect(indexBuiltAgain).toBe(indexBuiltFirst);
      }),
    );
  });
});
