import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { classModulesFor } from "./class-modules.ts";

layer(NodeServices.layer)("classModulesFor", (it) => {
  describe("a class this file declares itself", () => {
    const it = test.extend("modulesOfOwnClass", () =>
      classModulesFor({
        file: "/repository/use.ts",
        source: "class Bag {}",
        workspaceRoot: "/repository",
        imported: null,
      }));

    it("is read out of the text at hand", ({ modulesOfOwnClass }) => {
      expect(modulesOfOwnClass).toStrictEqual([
        { path: "/repository/use.ts", source: "class Bag {}" },
      ]);
    });
  });

  describe("a class taken from a neighbouring file", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const root = yield* Effect.gen(function* root() {
        const filesystem = yield* FileSystem.FileSystem;
        const repositoryDirectory = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "class-modules-" }),
        );

        return repositoryDirectory;
      });
      const modulesOfNeighbourClass = yield* Effect.gen(function* modulesOfNeighbourClass() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        yield* filesystem.writeFileString(paths.join(root, "bag.ts"), "export class Bag {}");
        return classModulesFor({
          file: paths.join(root, "use.ts"),
          source: "import { Bag } from './bag.ts';",
          workspaceRoot: root,
          imported: { specifier: "./bag.ts", exported: "Bag" },
        });
      });
      return { root, modulesOfNeighbourClass };
    });

    it.effect("is read out of that file", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { modulesOfNeighbourClass, root } = yield* fixtures;
        expect(modulesOfNeighbourClass).toStrictEqual([
          { path: paths.join(root, "bag.ts"), source: "export class Bag {}" },
        ]);
      }),
    );
  });

  describe("a class taken from a package this repository does not carry", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const root = yield* Effect.gen(function* root() {
        const filesystem = yield* FileSystem.FileSystem;
        const repositoryDirectory = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "class-modules-" }),
        );

        return repositoryDirectory;
      });
      const modulesOfAbsentPackageClass = classModulesFor({
        file: paths.join(root, "use.ts"),
        source: "import { Headers } from 'undici';",
        workspaceRoot: root,
        imported: { specifier: "undici", exported: "Headers" },
      });
      return { root, modulesOfAbsentPackageClass };
    });

    it.effect("is nowhere to read", () =>
      Effect.gen(function* program() {
        const { modulesOfAbsentPackageClass } = yield* fixtures;
        expect(modulesOfAbsentPackageClass).toStrictEqual([]);
      }),
    );
  });

  describe("a path that leads to no file", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const root = yield* Effect.gen(function* root() {
        const filesystem = yield* FileSystem.FileSystem;
        const repositoryDirectory = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "class-modules-" }),
        );

        return repositoryDirectory;
      });
      const modulesOfPackageEntryThatIsNotThere = yield* Effect.gen(
        function* modulesOfPackageEntryThatIsNotThere() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          yield* filesystem.makeDirectory(paths.join(root, "packages", "bag"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "bag", "package.json"),
            '{ "name": "@fixture/bag", "exports": { ".": "./missing.ts" } }\n',
          );
          yield* filesystem.makeDirectory(paths.join(root, "node_modules", "@fixture"), {
            recursive: true,
          });
          yield* filesystem.symlink(
            paths.join(root, "packages", "bag"),
            paths.join(root, "node_modules", "@fixture", "bag"),
          );
          return classModulesFor({
            file: paths.join(root, "use.ts"),
            source: "import { Bag } from '@fixture/bag';",
            workspaceRoot: root,
            imported: { specifier: "@fixture/bag", exported: "Bag" },
          });
        },
      );
      return { root, modulesOfPackageEntryThatIsNotThere };
    });

    it.effect("drops out of the modules to read", () =>
      Effect.gen(function* program() {
        const { modulesOfPackageEntryThatIsNotThere } = yield* fixtures;
        expect(modulesOfPackageEntryThatIsNotThere).toStrictEqual([]);
      }),
    );
  });

  describe("a public entry a package declares but does not carry", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const root = yield* Effect.gen(function* root() {
        const filesystem = yield* FileSystem.FileSystem;
        const repositoryDirectory = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "class-modules-" }),
        );

        return repositoryDirectory;
      });
      const modulesOfPackageEntryPartlyCarried = yield* Effect.gen(
        function* modulesOfPackageEntryPartlyCarried() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          yield* filesystem.makeDirectory(paths.join(root, "packages", "bag"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "bag", "package.json"),
            '{"name":"@fixture/bag","exports":{".":{"import":"./built.ts","default":"./bag.ts"}}}',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "bag", "bag.ts"),
            "export class Bag {}",
          );
          yield* filesystem.makeDirectory(paths.join(root, "node_modules", "@fixture"), {
            recursive: true,
          });
          yield* filesystem.symlink(
            paths.join(root, "packages", "bag"),
            paths.join(root, "node_modules", "@fixture", "bag"),
          );
          return classModulesFor({
            file: paths.join(root, "src", "use.ts"),
            source: "import { Bag } from '@fixture/bag';",
            workspaceRoot: root,
            imported: { specifier: "@fixture/bag", exported: "Bag" },
          });
        },
      );
      return { root, modulesOfPackageEntryPartlyCarried };
    });

    it.effect("drops out of the modules to read", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { modulesOfPackageEntryPartlyCarried, root } = yield* fixtures;
        expect(modulesOfPackageEntryPartlyCarried).toStrictEqual([
          { path: paths.join(root, "packages", "bag", "bag.ts"), source: "export class Bag {}" },
        ]);
      }),
    );
  });
});
