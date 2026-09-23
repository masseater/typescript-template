import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { buildSetupExportSpecifierIndex } from "./export-specifier-index.ts";
import {
  packageDirectoryInWorkspace,
  packageReferenceOf,
  resolveCoupling,
} from "./specifier-resolution.ts";

const WORKSPACE_STEM = "setup-modules-specifier-workspace-";

describe("packageReferenceOf", () => {
  describe("a scope written without a package name", () => {
    const it = test.extend("referenceOfBareScope", () => packageReferenceOf("@fixture"));

    it("references no package", ({ referenceOfBareScope }) => {
      expect(referenceOfBareScope).toBe(null);
    });
  });

  describe("a package written with a subpath", () => {
    const it = test.extend("referenceOfScopedSubpath", () =>
      packageReferenceOf("@fixture/shared/http"));

    it("references that subpath", ({ referenceOfScopedSubpath }) => {
      expect(referenceOfScopedSubpath).toStrictEqual({
        name: "@fixture/shared",
        subpath: "./http",
      });
    });
  });
});

layer(NodeServices.layer)("packageDirectoryInWorkspace", (it) => {
  describe("a specifier naming no package", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: WORKSPACE_STEM });

        return root;
      });
      const directoryOfBareScope = packageDirectoryInWorkspace({
        specifier: "@fixture",
        fromFile: paths.join(workspaceRoot, "spec.test.ts"),
        workspaceRoot,
      });
      return { workspaceRoot, directoryOfBareScope };
    });

    it.effect("resolves to no package directory", () =>
      Effect.gen(function* program() {
        const { directoryOfBareScope } = yield* fixtures;
        expect(directoryOfBareScope).toBe(null);
      }),
    );
  });

  describe("a package installed as a copy of its own", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: WORKSPACE_STEM });

        return root;
      });
      const directoryOfVendoredCopy = yield* Effect.gen(function* directoryOfVendoredCopy() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const installed = paths.join(workspaceRoot, "node_modules", "vendored");
        yield* filesystem.makeDirectory(installed, { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(installed, "package.json"),
          '{"name":"vendored"}',
        );
        return packageDirectoryInWorkspace({
          specifier: "vendored",
          fromFile: paths.join(workspaceRoot, "spec.test.ts"),
          workspaceRoot,
        });
      });
      return { workspaceRoot, directoryOfVendoredCopy };
    });

    it.effect("is outside the workspace source", () =>
      Effect.gen(function* program() {
        const { directoryOfVendoredCopy } = yield* fixtures;
        expect(directoryOfVendoredCopy).toBe(null);
      }),
    );
  });

  describe("a package linked from outside the workspace", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: WORKSPACE_STEM });

        return root;
      });
      const directoryOfPackageLinkedFromOutside = yield* Effect.gen(
        function* directoryOfPackageLinkedFromOutside() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const outside = yield* filesystem.makeTempDirectoryScoped({
            prefix: "setup-modules-specifier-outside-",
          });

          yield* filesystem.writeFileString(
            paths.join(outside, "package.json"),
            '{"name":"outsider"}',
          );
          const link = paths.join(workspaceRoot, "node_modules", "outsider");
          yield* filesystem.makeDirectory(paths.join(link, ".."), { recursive: true });
          yield* filesystem.symlink(outside, link);
          return packageDirectoryInWorkspace({
            specifier: "outsider",
            fromFile: paths.join(workspaceRoot, "spec.test.ts"),
            workspaceRoot,
          });
        },
      );
      return { workspaceRoot, directoryOfPackageLinkedFromOutside };
    });

    it.effect("is not read as workspace source", () =>
      Effect.gen(function* program() {
        const { directoryOfPackageLinkedFromOutside } = yield* fixtures;
        expect(directoryOfPackageLinkedFromOutside).toBe(null);
      }),
    );
  });
});

layer(NodeServices.layer)("resolveCoupling", (it) => {
  describe("a specifier written as an absolute path", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: WORKSPACE_STEM });

        return root;
      });
      const couplingOfAbsoluteSpecifier = yield* Effect.gen(
        function* couplingOfAbsoluteSpecifier() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const held = paths.join(workspaceRoot, "held.ts");
          yield* filesystem.writeFileString(held, "export const held = 1;\n");
          return resolveCoupling({
            specifier: held,
            fromFile: paths.join(workspaceRoot, "spec.test.ts"),
            workspaceRoot,
          });
        },
      );
      return { workspaceRoot, couplingOfAbsoluteSpecifier };
    });

    it.effect("is left unresolved", () =>
      Effect.gen(function* program() {
        const { couplingOfAbsoluteSpecifier } = yield* fixtures;
        expect(couplingOfAbsoluteSpecifier).toBe(null);
      }),
    );
  });

  describe("a relative specifier written without an extension", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: WORKSPACE_STEM });

        return root;
      });
      const couplingOfExtensionlessSpecifier = yield* Effect.gen(
        function* couplingOfExtensionlessSpecifier() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          yield* filesystem.writeFileString(
            paths.join(workspaceRoot, "held.ts"),
            "export const held = 1;\n",
          );
          return resolveCoupling({
            specifier: "./held",
            fromFile: paths.join(workspaceRoot, "spec.test.ts"),
            workspaceRoot,
          });
        },
      );
      return { workspaceRoot, couplingOfExtensionlessSpecifier };
    });

    it.effect("resolves to the module beside it", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { couplingOfExtensionlessSpecifier, workspaceRoot } = yield* fixtures;
        expect(couplingOfExtensionlessSpecifier).toStrictEqual({
          kind: "repositoryFile",
          path: paths.join(workspaceRoot, "held.ts"),
        });
      }),
    );
  });

  describe("a relative specifier written with a built extension", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: WORKSPACE_STEM });

        return root;
      });
      const couplingOfBuiltExtensionSpecifier = yield* Effect.gen(
        function* couplingOfBuiltExtensionSpecifier() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          yield* filesystem.writeFileString(
            paths.join(workspaceRoot, "held.ts"),
            "export const held = 1;\n",
          );
          return resolveCoupling({
            specifier: "./held.js",
            fromFile: paths.join(workspaceRoot, "spec.test.ts"),
            workspaceRoot,
          });
        },
      );
      return { workspaceRoot, couplingOfBuiltExtensionSpecifier };
    });

    it.effect("resolves to the source beside it", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { couplingOfBuiltExtensionSpecifier, workspaceRoot } = yield* fixtures;
        expect(couplingOfBuiltExtensionSpecifier).toStrictEqual({
          kind: "repositoryFile",
          path: paths.join(workspaceRoot, "held.ts"),
        });
      }),
    );
  });

  describe("a relative specifier naming a directory", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: WORKSPACE_STEM });

        return root;
      });
      const couplingOfDirectorySpecifier = yield* Effect.gen(
        function* couplingOfDirectorySpecifier() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          yield* filesystem.makeDirectory(paths.join(workspaceRoot, "held"));
          yield* filesystem.writeFileString(
            paths.join(workspaceRoot, "held", "index.ts"),
            "export const held = 1;\n",
          );
          return resolveCoupling({
            specifier: "./held",
            fromFile: paths.join(workspaceRoot, "spec.test.ts"),
            workspaceRoot,
          });
        },
      );
      return { workspaceRoot, couplingOfDirectorySpecifier };
    });

    it.effect("resolves to the index inside it", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { couplingOfDirectorySpecifier, workspaceRoot } = yield* fixtures;
        expect(couplingOfDirectorySpecifier).toStrictEqual({
          kind: "repositoryFile",
          path: paths.join(workspaceRoot, "held", "index.ts"),
        });
      }),
    );
  });
});

layer(NodeServices.layer)("buildSetupExportSpecifierIndex", (it) => {
  describe("a package whose export entry re-exports further modules", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: WORKSPACE_STEM });

        return root;
      });
      const exportIndexOfReExportingPackage = yield* Effect.gen(
        function* exportIndexOfReExportingPackage() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(workspaceRoot, "shared");
          yield* filesystem.makeDirectory(paths.join(packageDirectory, "src", "nested"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "@fixture/shared",
              exports: {
                ".": {
                  types: "./src/index.d.ts",
                  import: "./src/index.ts",
                  require: ["../outside.cjs", "./src/index.ts"],
                },
                "./package.json": "./package.json",
              },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "src", "index.ts"),
            'export * from "./nested/one";\nexport * from "external";\n',
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "src", "nested", "one.ts"),
            'export { value } from "./two.mjs";\n',
          );
          yield* filesystem.writeFileString(
            paths.join(packageDirectory, "src", "nested", "two.mts"),
            'export * from "../../../../index.ts";\n',
          );
          return buildSetupExportSpecifierIndex(packageDirectory);
        },
      );
      return { workspaceRoot, exportIndexOfReExportingPackage };
    });

    it.effect("indexes every file reachable through those re-exports", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { exportIndexOfReExportingPackage, workspaceRoot } = yield* fixtures;
        expect(exportIndexOfReExportingPackage).toStrictEqual(
          new Map([
            [paths.join(workspaceRoot, "shared", "src", "index.ts"), "@fixture/shared"],
            [paths.join(workspaceRoot, "shared", "src", "nested", "one.ts"), "@fixture/shared"],
            [paths.join(workspaceRoot, "shared", "src", "nested", "two.mts"), "@fixture/shared"],
          ]),
        );
      }),
    );
  });

  describe("a package whose manifest names nothing", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: WORKSPACE_STEM });

        return root;
      });
      const exportIndexOfNamelessManifest = yield* Effect.gen(
        function* exportIndexOfNamelessManifest() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const packageDirectory = paths.join(workspaceRoot, "shared");
          yield* filesystem.makeDirectory(packageDirectory, { recursive: true });
          yield* filesystem.writeFileString(paths.join(packageDirectory, "package.json"), "{}");
          return buildSetupExportSpecifierIndex(packageDirectory);
        },
      );
      return { workspaceRoot, exportIndexOfNamelessManifest };
    });

    it.effect("contributes no exported repository file", () =>
      Effect.gen(function* program() {
        const { exportIndexOfNamelessManifest } = yield* fixtures;
        expect(exportIndexOfNamelessManifest).toStrictEqual(new Map());
      }),
    );
  });
});
