import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { buildSetupExportSpecifierIndex } from "./export-specifier-index.ts";

layer(NodeServices.layer)("setup-modules/export-specifier-index", (it) => {
  describe("a package manifest holding null", () => {
    const fixture = Effect.gen(function* specifierIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const packageRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-export-index-",
      });

      yield* filesystem.writeFileString(paths.join(packageRoot, "package.json"), "null");
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it.effect("indexes no source", () =>
      Effect.gen(function* program() {
        const specifierIndex = yield* fixture;
        expect(specifierIndex).toStrictEqual(new Map<string, string>());
      }),
    );
  });

  describe("a package manifest holding an array", () => {
    const fixture = Effect.gen(function* specifierIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const packageRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-export-index-",
      });

      yield* filesystem.writeFileString(paths.join(packageRoot, "package.json"), "[]");
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it.effect("indexes no source", () =>
      Effect.gen(function* program() {
        const specifierIndex = yield* fixture;
        expect(specifierIndex).toStrictEqual(new Map<string, string>());
      }),
    );
  });

  describe("a package manifest holding no name", () => {
    const fixture = Effect.gen(function* specifierIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const packageRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-export-index-",
      });

      yield* filesystem.writeFileString(paths.join(packageRoot, "package.json"), "{}");
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it.effect("indexes no source", () =>
      Effect.gen(function* program() {
        const specifierIndex = yield* fixture;
        expect(specifierIndex).toStrictEqual(new Map<string, string>());
      }),
    );
  });

  describe("a package manifest holding an empty name", () => {
    const fixture = Effect.gen(function* specifierIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const packageRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-export-index-",
      });

      yield* filesystem.writeFileString(paths.join(packageRoot, "package.json"), '{"name":""}');
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it.effect("indexes no source", () =>
      Effect.gen(function* program() {
        const specifierIndex = yield* fixture;
        expect(specifierIndex).toStrictEqual(new Map<string, string>());
      }),
    );
  });

  describe("conditional and duplicate entry targets reaching the same sources", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const sharedSpecifierRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-export-index-shared-specifier-",
      });
      const specifierIndex = yield* Effect.gen(function* specifierIndex() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;

        yield* filesystem.makeDirectory(paths.join(sharedSpecifierRoot, "src/nested"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(sharedSpecifierRoot, "package.json"),
          yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            name: "fixture",
            exports: {
              ".": {
                types: "./src/index.d.ts",
                import: "./src/index.ts",
                require: "./src/index.ts",
              },
              "./alias": "./src/index.ts",
              "./package.json": "./package.json",
              "./ignored": [null, 1, ["./src/ignored.ts"]],
            },
          }),
        );
        yield* filesystem.writeFileString(
          paths.join(sharedSpecifierRoot, "src/index.ts"),
          'export * from "./nested";\nexport * from "external";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(sharedSpecifierRoot, "src/nested/index.ts"),
          'export * from "../../../../index.ts";\nexport * from "./missing";\n',
        );
        return buildSetupExportSpecifierIndex(sharedSpecifierRoot);
      });
      return { sharedSpecifierRoot, specifierIndex };
    });

    it.effect("share one public specifier", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { specifierIndex, sharedSpecifierRoot } = yield* fixtures;
        expect(specifierIndex).toStrictEqual(
          new Map<string, string>([
            [paths.join(sharedSpecifierRoot, "src/index.ts"), "fixture"],
            [paths.join(sharedSpecifierRoot, "src/nested/index.ts"), "fixture"],
          ]),
        );
      }),
    );
  });

  describe("an entry re-exporting through a chain deeper than the traversal allows", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const depthLimitRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-export-index-depth-limit-",
      });
      const specifierIndex = yield* Effect.gen(function* specifierIndex() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;

        yield* filesystem.makeDirectory(paths.join(depthLimitRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(depthLimitRoot, "package.json"),
          yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            name: "fixture",
            exports: "./src/zero.ts",
          }),
        );
        yield* filesystem.writeFileString(
          paths.join(depthLimitRoot, "src/zero.ts"),
          'export * from "./1.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(depthLimitRoot, "src/1.ts"),
          'export * from "./2.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(depthLimitRoot, "src/2.ts"),
          'export * from "./3.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(depthLimitRoot, "src/3.ts"),
          'export * from "./4.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(depthLimitRoot, "src/4.ts"),
          'export * from "./5.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(depthLimitRoot, "src/5.ts"),
          'export * from "./6.ts";\n',
        );
        return buildSetupExportSpecifierIndex(depthLimitRoot);
      });
      return { depthLimitRoot, specifierIndex };
    });

    it.effect("stops at the configured depth", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { specifierIndex, depthLimitRoot } = yield* fixtures;
        expect(specifierIndex).toStrictEqual(
          new Map<string, string>([
            [paths.join(depthLimitRoot, "src/zero.ts"), "fixture"],
            [paths.join(depthLimitRoot, "src/1.ts"), "fixture"],
            [paths.join(depthLimitRoot, "src/2.ts"), "fixture"],
            [paths.join(depthLimitRoot, "src/3.ts"), "fixture"],
            [paths.join(depthLimitRoot, "src/4.ts"), "fixture"],
          ]),
        );
      }),
    );
  });

  describe("an export condition nested deeper than the condition limit", () => {
    const fixture = Effect.gen(function* specifierIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const packageRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-export-index-",
      });

      const overDeepExports = Array.from({ length: 12 }).reduce<unknown>(
        (nestedTarget) => ({ default: nestedTarget }),
        "./src/index.ts",
      );
      yield* filesystem.makeDirectory(paths.join(packageRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(packageRoot, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "fixture",
          exports: overDeepExports,
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(packageRoot, "src/index.ts"),
        "export const total = 1;\n",
      );
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it.effect("contributes no source", () =>
      Effect.gen(function* program() {
        const specifierIndex = yield* fixture;
        expect(specifierIndex).toStrictEqual(new Map<string, string>());
      }),
    );
  });

  describe("entry targets pointing outside the package and at declarations", () => {
    const fixture = Effect.gen(function* specifierIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const packageRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-export-index-",
      });

      yield* filesystem.makeDirectory(paths.join(packageRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(packageRoot, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "fixture",
          exports: { ".": "../outside.ts", "./types": "./src/index.d.ts" },
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(packageRoot, "src/index.d.ts"),
        "export declare const total: number;\n",
      );
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it.effect("index no source", () =>
      Effect.gen(function* program() {
        const specifierIndex = yield* fixture;
        expect(specifierIndex).toStrictEqual(new Map<string, string>());
      }),
    );
  });

  describe("a named package declaring no exports", () => {
    const fixture = Effect.gen(function* specifierIndex() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const packageRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "setup-export-index-",
      });

      yield* filesystem.writeFileString(
        paths.join(packageRoot, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ name: "fixture" }),
      );
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it.effect("indexes no source", () =>
      Effect.gen(function* program() {
        const specifierIndex = yield* fixture;
        expect(specifierIndex).toStrictEqual(new Map<string, string>());
      }),
    );
  });
});
