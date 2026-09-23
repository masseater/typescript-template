import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { dependencyTypeEntries } from "./dependency-types.ts";

layer(NodeServices.layer)("dependencyTypeEntries", (it) => {
  describe("a dependency that names its declarations through its export map", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheExportMapPackage = yield* Effect.gen(
        function* typedDependenciesOfTheExportMapPackage() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "export-map");

          yield* filesystem.makeDirectory(
            paths.join(packageDirectory, "node_modules", "oxlint", "dist"),
            { recursive: true },
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { oxlint: "1.76.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "dist", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfTheExportMapPackage };
    });

    it.effect("becomes an entry", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesOfTheExportMapPackage, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesOfTheExportMapPackage).toStrictEqual([
          {
            packageName: "oxlint",
            declarationsPath: paths.join(
              fixtureRoot,
              "export-map",
              "node_modules",
              "oxlint",
              "dist",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("an export map spelled as one path", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheOnePathExportMap = yield* Effect.gen(
        function* typedDependenciesOfTheOnePathExportMap() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "export-map-as-one-path");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "oxlint"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { oxlint: "1.76.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              exports: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfTheOnePathExportMap };
    });

    it.effect("is read as that path", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesOfTheOnePathExportMap, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesOfTheOnePathExportMap).toStrictEqual([
          {
            packageName: "oxlint",
            declarationsPath: paths.join(
              fixtureRoot,
              "export-map-as-one-path",
              "node_modules",
              "oxlint",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("an export map that names only subpaths", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheSubpathOnlyExportMap = yield* Effect.gen(
        function* typedDependenciesOfTheSubpathOnlyExportMap() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "export-map-of-subpaths");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "oxlint"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { oxlint: "1.76.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              exports: { "./plugins": "./plugins.d.ts" },
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfTheSubpathOnlyExportMap };
    });

    it.effect("hands back no root entry, so the declared types field decides", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesOfTheSubpathOnlyExportMap, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesOfTheSubpathOnlyExportMap).toStrictEqual([
          {
            packageName: "oxlint",
            declarationsPath: paths.join(
              fixtureRoot,
              "export-map-of-subpaths",
              "node_modules",
              "oxlint",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("an export map holding conditions that name nothing", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheEmptyConditionExportMap = yield* Effect.gen(
        function* typedDependenciesOfTheEmptyConditionExportMap() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "export-map-of-empty-conditions");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "oxlint"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { oxlint: "1.76.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              exports: { ".": { node: { import: {} } } },
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfTheEmptyConditionExportMap };
    });

    it.effect("hands back no entry, so the declared types field decides", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesOfTheEmptyConditionExportMap, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesOfTheEmptyConditionExportMap).toStrictEqual([
          {
            packageName: "oxlint",
            declarationsPath: paths.join(
              fixtureRoot,
              "export-map-of-empty-conditions",
              "node_modules",
              "oxlint",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("an entry path that carries no suffix", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheSuffixlessEntryPath = yield* Effect.gen(
        function* typedDependenciesOfTheSuffixlessEntryPath() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "entry-path-without-a-suffix");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "oxlint"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { oxlint: "1.76.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              exports: { ".": { default: "./index" } },
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfTheSuffixlessEntryPath };
    });

    it.effect("names no declarations, so the declared types field decides", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesOfTheSuffixlessEntryPath, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesOfTheSuffixlessEntryPath).toStrictEqual([
          {
            packageName: "oxlint",
            declarationsPath: paths.join(
              fixtureRoot,
              "entry-path-without-a-suffix",
              "node_modules",
              "oxlint",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("a dependency declared for development", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDevelopmentDependencies = yield* Effect.gen(
        function* typedDevelopmentDependencies() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "development-dependency");

          yield* filesystem.makeDirectory(
            paths.join(packageDirectory, "node_modules", "vite", "dist", "node"),
            {
              recursive: true,
            },
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              devDependencies: { vite: "8.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "vite", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              types: "./dist/node/index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "vite", "dist", "node", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDevelopmentDependencies };
    });

    it.effect("is reachable the same way", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDevelopmentDependencies, fixtureRoot } = yield* fixtures;
        expect(typedDevelopmentDependencies).toStrictEqual([
          {
            packageName: "vite",
            declarationsPath: paths.join(
              fixtureRoot,
              "development-dependency",
              "node_modules",
              "vite",
              "dist",
              "node",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("a dependency declared as a peer", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedPeerDependencies = yield* Effect.gen(function* typedPeerDependencies() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const packageDirectory = paths.join(fixtureRoot, "peer-dependency");

        yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "oxlint"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(packageDirectory, "package.json"),
          yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            peerDependencies: { oxlint: "*" },
          }),
        );
        yield* filesystem.writeFileString(
          paths.join(packageDirectory, "node_modules", "oxlint", "package.json"),
          yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            typings: "./index.d.ts",
          }),
        );
        yield* filesystem.writeFileString(
          paths.join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
          "export {};\n",
        );
        return dependencyTypeEntries(packageDirectory);
      });
      return { fixtureRoot, typedPeerDependencies };
    });

    it.effect("is reachable the same way", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedPeerDependencies, fixtureRoot } = yield* fixtures;
        expect(typedPeerDependencies).toStrictEqual([
          {
            packageName: "oxlint",
            declarationsPath: paths.join(
              fixtureRoot,
              "peer-dependency",
              "node_modules",
              "oxlint",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("a dependency inside this repository", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesBesideTheWorkspacePackage = yield* Effect.gen(
        function* typedDependenciesBesideTheWorkspacePackage() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "repository-dependency");

          yield* filesystem.makeDirectory(
            paths.join(packageDirectory, "node_modules", "@mst", "lint-rule-authoring", "src"),
            {
              recursive: true,
            },
          );
          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "oxlint"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: {
                "@repo/dont-review-it/lint-rule-authoring": "workspace:*",
                oxlint: "1.76.0",
              },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(
              packageDirectory,
              "node_modules",
              "@mst",
              "lint-rule-authoring",
              "package.json",
            ),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              exports: { ".": "./src/index.ts" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(
              packageDirectory,
              "node_modules",
              "@mst",
              "lint-rule-authoring",
              "src",
              "index.ts",
            ),
            "export {};\n",
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesBesideTheWorkspacePackage };
    });

    it.effect("is left to the repository catalog", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesBesideTheWorkspacePackage, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesBesideTheWorkspacePackage).toStrictEqual([
          {
            packageName: "oxlint",
            declarationsPath: paths.join(
              fixtureRoot,
              "repository-dependency",
              "node_modules",
              "oxlint",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("a types condition nested under another condition", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheNestedTypesCondition = yield* Effect.gen(
        function* typedDependenciesOfTheNestedTypesCondition() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "nested-types-condition");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "nested"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { nested: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "nested", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              exports: { ".": { import: { types: "./index.d.mts", default: "./index.mjs" } } },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "nested", "index.d.mts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfTheNestedTypesCondition };
    });

    it.effect("is still found", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesOfTheNestedTypesCondition, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesOfTheNestedTypesCondition).toStrictEqual([
          {
            packageName: "nested",
            declarationsPath: paths.join(
              fixtureRoot,
              "nested-types-condition",
              "node_modules",
              "nested",
              "index.d.mts",
            ),
          },
        ]);
      }),
    );
  });

  describe("an export map that names conditions without a subpath", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheSubpathlessConditions = yield* Effect.gen(
        function* typedDependenciesOfTheSubpathlessConditions() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "conditions-without-a-subpath");

          yield* filesystem.makeDirectory(
            paths.join(packageDirectory, "node_modules", "rootonly"),
            { recursive: true },
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { rootonly: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "rootonly", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              exports: { types: "./index.d.ts", default: "./index.js" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "rootonly", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfTheSubpathlessConditions };
    });

    it.effect("is read as the root entry", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesOfTheSubpathlessConditions, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesOfTheSubpathlessConditions).toStrictEqual([
          {
            packageName: "rootonly",
            declarationsPath: paths.join(
              fixtureRoot,
              "conditions-without-a-subpath",
              "node_modules",
              "rootonly",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("a package that only names its runtime entry", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheRuntimeEntryPackage = yield* Effect.gen(
        function* typedDependenciesOfTheRuntimeEntryPackage() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "runtime-entry-beside-declarations");

          yield* filesystem.makeDirectory(
            paths.join(packageDirectory, "node_modules", "runtimeonly", "dist"),
            {
              recursive: true,
            },
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { runtimeonly: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "runtimeonly", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              main: "./dist/index.js",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "runtimeonly", "dist", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfTheRuntimeEntryPackage };
    });

    it.effect("points at the declarations beside it", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesOfTheRuntimeEntryPackage, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesOfTheRuntimeEntryPackage).toStrictEqual([
          {
            packageName: "runtimeonly",
            declarationsPath: paths.join(
              fixtureRoot,
              "runtime-entry-beside-declarations",
              "node_modules",
              "runtimeonly",
              "dist",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("a package that ships no type declarations", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfThePackageWithoutDeclarations = yield* Effect.gen(
        function* typedDependenciesOfThePackageWithoutDeclarations() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "runtime-entry-without-declarations");

          yield* filesystem.makeDirectory(
            paths.join(packageDirectory, "node_modules", "runtimeonly", "dist"),
            {
              recursive: true,
            },
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { runtimeonly: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "runtimeonly", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              main: "./dist/index.js",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "runtimeonly", "dist", "index.js"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfThePackageWithoutDeclarations };
    });

    it.effect("is left out", () =>
      Effect.gen(function* program() {
        const { typedDependenciesOfThePackageWithoutDeclarations } = yield* fixtures;
        expect(typedDependenciesOfThePackageWithoutDeclarations).toStrictEqual([]);
      }),
    );
  });

  describe("a dependency missing from the checkout", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesBesideThePrunedDependency = yield* Effect.gen(
        function* typedDependenciesBesideThePrunedDependency() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "pruned-dependency");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "oxlint"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { oxlint: "1.76.0", pruned: "1.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesBesideThePrunedDependency };
    });

    it.effect("costs only that dependency", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesBesideThePrunedDependency, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesBesideThePrunedDependency).toStrictEqual([
          {
            packageName: "oxlint",
            declarationsPath: paths.join(
              fixtureRoot,
              "pruned-dependency",
              "node_modules",
              "oxlint",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("three dependencies installed out of order", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfThreeInstalledPackages = yield* Effect.gen(
        function* typedDependenciesOfThreeInstalledPackages() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "three-dependencies");

          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "oxlint"), {
            recursive: true,
          });
          yield* filesystem.makeDirectory(
            paths.join(packageDirectory, "node_modules", "@oxlint", "plugins"),
            { recursive: true },
          );
          yield* filesystem.makeDirectory(paths.join(packageDirectory, "node_modules", "vite"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              dependencies: { oxlint: "1.76.0" },
              devDependencies: { "@oxlint/plugins": "1.76.0", vite: "8.0.0" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "oxlint", "index.d.ts"),
            "export {};\n",
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "@oxlint", "plugins", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "@oxlint", "plugins", "index.d.ts"),
            "export {};\n",
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "vite", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              types: "./index.d.ts",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "node_modules", "vite", "index.d.ts"),
            "export {};\n",
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfThreeInstalledPackages };
    });

    it.effect("come back sorted by package name", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { typedDependenciesOfThreeInstalledPackages, fixtureRoot } = yield* fixtures;
        expect(typedDependenciesOfThreeInstalledPackages).toStrictEqual([
          {
            packageName: "@oxlint/plugins",
            declarationsPath: paths.join(
              fixtureRoot,
              "three-dependencies",
              "node_modules",
              "@oxlint",
              "plugins",
              "index.d.ts",
            ),
          },
          {
            packageName: "oxlint",
            declarationsPath: paths.join(
              fixtureRoot,
              "three-dependencies",
              "node_modules",
              "oxlint",
              "index.d.ts",
            ),
          },
          {
            packageName: "vite",
            declarationsPath: paths.join(
              fixtureRoot,
              "three-dependencies",
              "node_modules",
              "vite",
              "index.d.ts",
            ),
          },
        ]);
      }),
    );
  });

  describe("a package that declares no dependencies", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheLonePackage = yield* Effect.gen(
        function* typedDependenciesOfTheLonePackage() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "no-dependencies");

          yield* filesystem.makeDirectory(packageDirectory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name: "alone" }),
          );
          return dependencyTypeEntries(packageDirectory);
        },
      );
      return { fixtureRoot, typedDependenciesOfTheLonePackage };
    });

    it.effect("has nothing to offer", () =>
      Effect.gen(function* program() {
        const { typedDependenciesOfTheLonePackage } = yield* fixtures;
        expect(typedDependenciesOfTheLonePackage).toStrictEqual([]);
      }),
    );
  });

  describe("a directory that holds no manifest", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-dependency-types-",
      });
      const typedDependenciesOfTheManifestlessDirectory = yield* Effect.gen(
        function* typedDependenciesOfTheManifestlessDirectory() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(fixtureRoot, "no-manifest");

          yield* filesystem.makeDirectory(packageDirectory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name: "alone" }),
          );
          return dependencyTypeEntries(paths.join(packageDirectory, "src"));
        },
      );
      return { fixtureRoot, typedDependenciesOfTheManifestlessDirectory };
    });

    it.effect("has nothing to offer", () =>
      Effect.gen(function* program() {
        const { typedDependenciesOfTheManifestlessDirectory } = yield* fixtures;
        expect(typedDependenciesOfTheManifestlessDirectory).toStrictEqual([]);
      }),
    );
  });
});
