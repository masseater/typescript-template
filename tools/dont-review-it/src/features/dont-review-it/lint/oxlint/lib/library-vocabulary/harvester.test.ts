import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { attempt } from "es-toolkit";
import { API } from "typescript/unstable/sync";
import { describe, expect } from "vite-plus/test";

import { path } from "../../../../platform/path.ts";
import { createLibraryVocabularyLoader } from "./harvester.ts";

const withLowerCaseDeclarationId = <Entry extends { readonly declarationId: string }>(
  vocabulary: readonly Entry[],
): readonly Entry[] =>
  vocabulary.map((entry) => ({
    ...entry,
    declarationId: entry.declarationId.toLowerCase(),
  }));

class RuntimeRefusal extends Schema.TaggedError<RuntimeRefusal>()("RuntimeRefusal", {
  code: Schema.String,
}) {}

layer(NodeServices.layer)("createLibraryVocabularyLoader", (it) => {
  describe("a dependency exporting a union of string literals", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-library-vocabulary-harvester-",
      });
      const theVocabularyOfTheLiteralUnion = yield* Effect.gen(
        function* theVocabularyOfTheLiteralUnion() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "literal-union");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "palette"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "holder",
              dependencies: { palette: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "palette",
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "index.d.ts"),
            'export type Shade = "dark" | "light";\n',
          );
          return createLibraryVocabularyLoader({
            openApi: (directory) => new API({ cwd: directory }),
          })({
            filename: paths.join(packageDirectory, "src", "reader.ts"),
            repositoryRoot: fixtureRoot,
          });
        },
      );
      return { fixtureRoot, theVocabularyOfTheLiteralUnion };
    });

    it.effect("becomes an owner of the values it names", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { theVocabularyOfTheLiteralUnion, fixtureRoot } = yield* fixtures;
        expect(withLowerCaseDeclarationId(theVocabularyOfTheLiteralUnion)).toStrictEqual([
          {
            packageName: "palette",
            typeName: "Shade",
            declarationId: `${paths.join(fixtureRoot, "literal-union", "node_modules", "palette", "index.d.ts").toLowerCase()}#3`,
            values: ["dark", "light"],
            admitsUnnamedValues: false,
          },
        ]);
      }),
    );
  });

  describe("a dependency whose exported types admit values it does not name", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-library-vocabulary-harvester-",
      });
      const theVocabularyOfTheWidenedUnion = yield* Effect.gen(
        function* theVocabularyOfTheWidenedUnion() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "widened-union");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "palette"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "holder",
              dependencies: { palette: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "palette",
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "index.d.ts"),
            'export type Shade = "dark" | (string & {});\nexport type Plain = string;\nexport type Widths = string | number;\n',
          );
          return createLibraryVocabularyLoader({
            openApi: (directory) => new API({ cwd: directory }),
          })({
            filename: paths.join(packageDirectory, "src", "reader.ts"),
            repositoryRoot: fixtureRoot,
          });
        },
      );
      return { fixtureRoot, theVocabularyOfTheWidenedUnion };
    });

    it.effect("keeps only the type that names values, and records that others pass", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { theVocabularyOfTheWidenedUnion, fixtureRoot } = yield* fixtures;
        expect(withLowerCaseDeclarationId(theVocabularyOfTheWidenedUnion)).toStrictEqual([
          {
            packageName: "palette",
            typeName: "Shade",
            declarationId: `${paths.join(fixtureRoot, "widened-union", "node_modules", "palette", "index.d.ts").toLowerCase()}#3`,
            values: ["dark"],
            admitsUnnamedValues: true,
          },
        ]);
      }),
    );
  });

  describe("a dependency re-exporting a vocabulary declared beside it", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-library-vocabulary-harvester-",
      });
      const theVocabularyOfTheReExport = yield* Effect.gen(function* theVocabularyOfTheReExport() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const packageDirectory = paths.join(fixtureRoot, "re-export");

        yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "palette"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(packageDirectory, "package.json"),
          yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            name: "holder",
            dependencies: { palette: "1.0.0" },
          }),
        );
        yield* filesystem.writeFileString(
          paths.join(packageDirectory, "node_modules", "palette", "package.json"),
          yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            name: "palette",
            types: "./index.d.ts",
          }),
        );
        yield* filesystem.writeFileString(
          paths.join(packageDirectory, "node_modules", "palette", "tone.d.ts"),
          'export type Tone = "cool" | "warm";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(packageDirectory, "node_modules", "palette", "index.d.ts"),
          'export type { Tone } from "./tone";\n',
        );
        return createLibraryVocabularyLoader({
          openApi: (directory) => new API({ cwd: directory }),
        })({
          filename: paths.join(packageDirectory, "src", "reader.ts"),
          repositoryRoot: fixtureRoot,
        });
      });
      return { fixtureRoot, theVocabularyOfTheReExport };
    });

    it.effect("is read through to the declaration it points at", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { theVocabularyOfTheReExport, fixtureRoot } = yield* fixtures;
        expect(withLowerCaseDeclarationId(theVocabularyOfTheReExport)).toStrictEqual([
          {
            packageName: "palette",
            typeName: "Tone",
            declarationId: `${paths.join(fixtureRoot, "re-export", "node_modules", "palette", "tone.d.ts").toLowerCase()}#3`,
            values: ["cool", "warm"],
            admitsUnnamedValues: false,
          },
        ]);
      }),
    );
  });

  describe("a package that declares no dependencies", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-library-vocabulary-harvester-",
      });
      const theVocabularyOfTheLonePackage = yield* Effect.gen(
        function* theVocabularyOfTheLonePackage() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "no-dependencies");

          yield* filesystem.makeDirectory(packageDirectory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name: "alone" }),
          );
          return createLibraryVocabularyLoader({
            openApi: (directory) => new API({ cwd: directory }),
          })({
            filename: paths.join(packageDirectory, "src", "reader.ts"),
            repositoryRoot: fixtureRoot,
          });
        },
      );
      return { fixtureRoot, theVocabularyOfTheLonePackage };
    });

    it.effect("has no vocabulary to offer", () =>
      Effect.gen(function* program() {
        const { theVocabularyOfTheLonePackage } = yield* fixtures;
        expect(theVocabularyOfTheLonePackage).toStrictEqual([]);
      }),
    );
  });

  describe("a file that no manifest governs", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-library-vocabulary-harvester-",
      });
      const theVocabularyOfTheUngovernedFile = yield* Effect.gen(
        function* theVocabularyOfTheUngovernedFile() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "no-manifest");

          yield* filesystem.makeDirectory(packageDirectory, { recursive: true });
          return createLibraryVocabularyLoader({
            openApi: (directory) => new API({ cwd: directory }),
          })({
            filename: paths.join(packageDirectory, "reader.ts"),
            repositoryRoot: packageDirectory,
          });
        },
      );
      return { fixtureRoot, theVocabularyOfTheUngovernedFile };
    });

    it.effect("has no vocabulary to offer", () =>
      Effect.gen(function* program() {
        const { theVocabularyOfTheUngovernedFile } = yield* fixtures;
        expect(theVocabularyOfTheUngovernedFile).toStrictEqual([]);
      }),
    );
  });

  describe("declarations that declare nothing the outside can import", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-library-vocabulary-harvester-",
      });
      const theVocabularyOfTheScriptDeclarations = yield* Effect.gen(
        function* theVocabularyOfTheScriptDeclarations() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "script-declarations");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "palette"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "holder",
              dependencies: { palette: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "palette",
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "index.d.ts"),
            'declare const shade: "dark" | "light";\n',
          );
          return createLibraryVocabularyLoader({
            openApi: (directory) => new API({ cwd: directory }),
          })({
            filename: paths.join(packageDirectory, "src", "reader.ts"),
            repositoryRoot: fixtureRoot,
          });
        },
      );
      return { fixtureRoot, theVocabularyOfTheScriptDeclarations };
    });

    it.effect("offer no vocabulary", () =>
      Effect.gen(function* program() {
        const { theVocabularyOfTheScriptDeclarations } = yield* fixtures;
        expect(theVocabularyOfTheScriptDeclarations).toStrictEqual([]);
      }),
    );
  });

  describe("declarations the runtime will not read", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-library-vocabulary-harvester-",
      });
      const theVocabularyOfTheUnreadableDeclarations = yield* Effect.gen(
        function* theVocabularyOfTheUnreadableDeclarations() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "unreadable-declarations");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "palette"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "holder",
              dependencies: { palette: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "palette",
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "index.d.ts"),
            'export type Shade = "dark" | "light";\n',
          );
          yield* filesystem.chmod(
            paths.join(packageDirectory, "node_modules", "palette", "index.d.ts"),
            0o000,
          );
          return createLibraryVocabularyLoader({
            openApi: (directory) => new API({ cwd: directory }),
          })({
            filename: paths.join(packageDirectory, "src", "reader.ts"),
            repositoryRoot: fixtureRoot,
          });
        },
      );
      return { fixtureRoot, theVocabularyOfTheUnreadableDeclarations };
    });

    it.effect("offer no vocabulary", () =>
      Effect.gen(function* program() {
        const { theVocabularyOfTheUnreadableDeclarations } = yield* fixtures;
        expect(theVocabularyOfTheUnreadableDeclarations).toStrictEqual([]);
      }),
    );
  });

  describe("a type checker the environment refuses to open", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-library-vocabulary-harvester-",
      });
      const theVocabularyAfterTheEnvironmentRefusal = yield* Effect.gen(
        function* theVocabularyAfterTheEnvironmentRefusal() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "environment-refusal");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "palette"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "holder",
              dependencies: { palette: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "palette",
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "index.d.ts"),
            'export type Shade = "dark" | "light";\n',
          );
          return createLibraryVocabularyLoader({
            openApi: () => {
              throw new RuntimeRefusal({ code: "EACCES" });
            },
          })({
            filename: paths.join(packageDirectory, "src", "reader.ts"),
            repositoryRoot: fixtureRoot,
          });
        },
      );
      return { fixtureRoot, theVocabularyAfterTheEnvironmentRefusal };
    });

    it.effect("leaves the vocabulary empty instead of stopping the lint run", () =>
      Effect.gen(function* program() {
        const { theVocabularyAfterTheEnvironmentRefusal } = yield* fixtures;
        expect(theVocabularyAfterTheEnvironmentRefusal).toStrictEqual([]);
      }),
    );
  });

  describe("a type checker that fails for a reason the environment does not name", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-library-vocabulary-harvester-",
      });
      const theFailureTheHarvestHandsBack = yield* Effect.gen(
        function* theFailureTheHarvestHandsBack() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "unnamed-failure");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "palette"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "holder",
              dependencies: { palette: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "palette",
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "palette", "index.d.ts"),
            'export type Shade = "dark" | "light";\n',
          );
          const [failure] = attempt(() =>
            createLibraryVocabularyLoader({
              openApi: () => {
                throw new TypeError("the type checker gave up");
              },
            })({
              filename: path.join(packageDirectory, "src", "reader.ts"),
              repositoryRoot: fixtureRoot,
            }),
          );
          return failure;
        },
      );
      return { fixtureRoot, theFailureTheHarvestHandsBack };
    });

    it.effect("hands the failure to the caller unchanged", () =>
      Effect.gen(function* program() {
        const { theFailureTheHarvestHandsBack } = yield* fixtures;
        expect(theFailureTheHarvestHandsBack).toStrictEqual(
          new TypeError("the type checker gave up"),
        );
      }),
    );
  });
});
