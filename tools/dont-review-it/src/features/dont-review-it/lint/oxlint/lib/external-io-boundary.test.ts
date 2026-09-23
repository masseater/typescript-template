import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { replacedModuleAt } from "./external-io-boundary.ts";

const WORKSPACE_FILES: Readonly<Record<string, string>> = {
  "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
  "packages/mailer/package.json": JSON.stringify({
    name: "@fixture/mailer",
    exports: { ".": "./src/index.ts" },
  }),
  "packages/mailer/src/index.ts": 'export * from "./transport.ts";\n',
  "packages/mailer/src/transport.ts":
    'import { writeFileSync } from "node:fs";\nexport const deliver = (path: string): void => writeFileSync(path, "");\n',
  "packages/mailer/src/send.ts":
    'import { deliver } from "./transport.ts";\nexport const send = (path: string): void => deliver(path);\n',
  "packages/mailer/src/queue.ts":
    'import { send } from "./send.ts";\nexport const queue = (path: string): void => send(path);\n',
  "packages/mailer/src/compose.ts":
    'import { join } from "node:path";\nexport const compose = (a: string, b: string): string => join(a, b);\n',
  "packages/mailer/src/client.ts":
    'import { fetch } from "undici/fetch";\nexport const ask = async (url: string) => fetch(url);\n',
  "packages/silent/package.json": JSON.stringify({
    name: "@fixture/silent",
    exports: { ".": "./src/absent.ts" },
  }),
};

const LINKED_PACKAGES: Readonly<Record<string, string>> = {
  "node_modules/@fixture/mailer": "packages/mailer",
  "node_modules/@fixture/silent": "packages/silent",
};

const VOCABULARY = {
  modules: new Set(["node:fs"]),
  packages: new Set(["undici"]),
};

const IMPORTING_FILE = "packages/mailer/src/send.test.ts";

layer(NodeServices.layer)("external-io-boundary", (it) => {
  describe("a module this repository does not hold", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const workspaceRoot = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "external-io-boundary-" }),
        );

        for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
          const writtenFile = paths.join(workspaceRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenFile), { recursive: true });
          yield* filesystem.writeFileString(writtenFile, writtenContent);
        }
        for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
          const link = paths.join(workspaceRoot, linkPath);
          yield* filesystem.makeDirectory(paths.dirname(link), { recursive: true });
          yield* filesystem.symlink(paths.join(workspaceRoot, linkedDirectory), link);
        }
        return workspaceRoot;
      });
      const replacementOfAnUnheldModule = replacedModuleAt({
        specifier: "node:fs",
        fromFile: paths.join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      });
      return { workspaceRoot, replacementOfAnUnheldModule };
    });

    it.effect("is a boundary of its own", () =>
      Effect.gen(function* program() {
        const { replacementOfAnUnheldModule } = yield* fixtures;
        expect(replacementOfAnUnheldModule).toStrictEqual({ kind: "outsideTheRepository" });
      }),
    );
  });

  describe("a module that reaches a named module", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const workspaceRoot = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "external-io-boundary-" }),
        );

        for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
          const writtenFile = paths.join(workspaceRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenFile), { recursive: true });
          yield* filesystem.writeFileString(writtenFile, writtenContent);
        }
        for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
          const link = paths.join(workspaceRoot, linkPath);
          yield* filesystem.makeDirectory(paths.dirname(link), { recursive: true });
          yield* filesystem.symlink(paths.join(workspaceRoot, linkedDirectory), link);
        }
        return workspaceRoot;
      });
      const replacementOfAModuleReachingANamedModule = replacedModuleAt({
        specifier: "./transport.ts",
        fromFile: paths.join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      });
      return { workspaceRoot, replacementOfAModuleReachingANamedModule };
    });

    it.effect("owns the boundary itself", () =>
      Effect.gen(function* program() {
        const { replacementOfAModuleReachingANamedModule } = yield* fixtures;
        expect(replacementOfAModuleReachingANamedModule).toStrictEqual({ kind: "ownsExternalIo" });
      }),
    );
  });

  describe("a module that reaches a named package", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const workspaceRoot = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "external-io-boundary-" }),
        );

        for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
          const writtenFile = paths.join(workspaceRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenFile), { recursive: true });
          yield* filesystem.writeFileString(writtenFile, writtenContent);
        }
        for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
          const link = paths.join(workspaceRoot, linkPath);
          yield* filesystem.makeDirectory(paths.dirname(link), { recursive: true });
          yield* filesystem.symlink(paths.join(workspaceRoot, linkedDirectory), link);
        }
        return workspaceRoot;
      });
      const replacementOfAModuleReachingANamedPackage = replacedModuleAt({
        specifier: "./client.ts",
        fromFile: paths.join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      });
      return { workspaceRoot, replacementOfAModuleReachingANamedPackage };
    });

    it.effect("owns the boundary the same way a named module does", () =>
      Effect.gen(function* program() {
        const { replacementOfAModuleReachingANamedPackage } = yield* fixtures;
        expect(replacementOfAModuleReachingANamedPackage).toStrictEqual({ kind: "ownsExternalIo" });
      }),
    );
  });

  describe("a module that reaches the outside through another one", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const workspaceRoot = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "external-io-boundary-" }),
        );

        for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
          const writtenFile = paths.join(workspaceRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenFile), { recursive: true });
          yield* filesystem.writeFileString(writtenFile, writtenContent);
        }
        for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
          const link = paths.join(workspaceRoot, linkPath);
          yield* filesystem.makeDirectory(paths.dirname(link), { recursive: true });
          yield* filesystem.symlink(paths.join(workspaceRoot, linkedDirectory), link);
        }
        return workspaceRoot;
      });
      const replacementOfAModuleOneStepInFrontOfTheBoundary = replacedModuleAt({
        specifier: "./send.ts",
        fromFile: paths.join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      });
      return { workspaceRoot, replacementOfAModuleOneStepInFrontOfTheBoundary };
    });

    it.effect("stands in front of the module that holds the boundary", () =>
      Effect.gen(function* program() {
        const { replacementOfAModuleOneStepInFrontOfTheBoundary } = yield* fixtures;
        expect(replacementOfAModuleOneStepInFrontOfTheBoundary).toStrictEqual({
          kind: "behindOwnModules",
          boundary: "packages/mailer/src/transport.ts",
        });
      }),
    );
  });

  describe("a module two steps in front of the boundary", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const workspaceRoot = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "external-io-boundary-" }),
        );

        for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
          const writtenFile = paths.join(workspaceRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenFile), { recursive: true });
          yield* filesystem.writeFileString(writtenFile, writtenContent);
        }
        for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
          const link = paths.join(workspaceRoot, linkPath);
          yield* filesystem.makeDirectory(paths.dirname(link), { recursive: true });
          yield* filesystem.symlink(paths.join(workspaceRoot, linkedDirectory), link);
        }
        return workspaceRoot;
      });
      const replacementOfAModuleTwoStepsInFrontOfTheBoundary = replacedModuleAt({
        specifier: "./queue.ts",
        fromFile: paths.join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      });
      return { workspaceRoot, replacementOfAModuleTwoStepsInFrontOfTheBoundary };
    });

    it.effect("is read the same way as one step in front", () =>
      Effect.gen(function* program() {
        const { replacementOfAModuleTwoStepsInFrontOfTheBoundary } = yield* fixtures;
        expect(replacementOfAModuleTwoStepsInFrontOfTheBoundary).toStrictEqual({
          kind: "behindOwnModules",
          boundary: "packages/mailer/src/transport.ts",
        });
      }),
    );
  });

  describe("a module that reaches nothing outside", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const workspaceRoot = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "external-io-boundary-" }),
        );

        for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
          const writtenFile = paths.join(workspaceRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenFile), { recursive: true });
          yield* filesystem.writeFileString(writtenFile, writtenContent);
        }
        for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
          const link = paths.join(workspaceRoot, linkPath);
          yield* filesystem.makeDirectory(paths.dirname(link), { recursive: true });
          yield* filesystem.symlink(paths.join(workspaceRoot, linkedDirectory), link);
        }
        return workspaceRoot;
      });
      const replacementOfAModuleReachingNothingOutside = replacedModuleAt({
        specifier: "./compose.ts",
        fromFile: paths.join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      });
      return { workspaceRoot, replacementOfAModuleReachingNothingOutside };
    });

    it.effect("is determined by what it is handed", () =>
      Effect.gen(function* program() {
        const { replacementOfAModuleReachingNothingOutside } = yield* fixtures;
        expect(replacementOfAModuleReachingNothingOutside).toStrictEqual({
          kind: "determinedByItsInput",
        });
      }),
    );
  });

  describe("a package named by its own name", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const workspaceRoot = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "external-io-boundary-" }),
        );

        for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
          const writtenFile = paths.join(workspaceRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenFile), { recursive: true });
          yield* filesystem.writeFileString(writtenFile, writtenContent);
        }
        for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
          const link = paths.join(workspaceRoot, linkPath);
          yield* filesystem.makeDirectory(paths.dirname(link), { recursive: true });
          yield* filesystem.symlink(paths.join(workspaceRoot, linkedDirectory), link);
        }
        return workspaceRoot;
      });
      const replacementOfAPackageNamedByItsOwnName = replacedModuleAt({
        specifier: "@fixture/mailer",
        fromFile: paths.join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      });
      return { workspaceRoot, replacementOfAPackageNamedByItsOwnName };
    });

    it.effect("is read through the entries it publishes", () =>
      Effect.gen(function* program() {
        const { replacementOfAPackageNamedByItsOwnName } = yield* fixtures;
        expect(replacementOfAPackageNamedByItsOwnName).toStrictEqual({
          kind: "behindOwnModules",
          boundary: "packages/mailer/src/transport.ts",
        });
      }),
    );
  });

  describe("a package whose published entry is absent", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const workspaceRoot = yield* Effect.gen(function* workspaceRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const workspaceRoot = yield* filesystem.realPath(
          yield* filesystem.makeTempDirectoryScoped({ prefix: "external-io-boundary-" }),
        );

        for (const [relativePath, writtenContent] of Object.entries(WORKSPACE_FILES)) {
          const writtenFile = paths.join(workspaceRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenFile), { recursive: true });
          yield* filesystem.writeFileString(writtenFile, writtenContent);
        }
        for (const [linkPath, linkedDirectory] of Object.entries(LINKED_PACKAGES)) {
          const link = paths.join(workspaceRoot, linkPath);
          yield* filesystem.makeDirectory(paths.dirname(link), { recursive: true });
          yield* filesystem.symlink(paths.join(workspaceRoot, linkedDirectory), link);
        }
        return workspaceRoot;
      });
      const replacementOfAPackageWithAnAbsentEntry = replacedModuleAt({
        specifier: "@fixture/silent",
        fromFile: paths.join(workspaceRoot, IMPORTING_FILE),
        vocabulary: VOCABULARY,
      });
      return { workspaceRoot, replacementOfAPackageWithAnAbsentEntry };
    });

    it.effect("reaches nothing", () =>
      Effect.gen(function* program() {
        const { replacementOfAPackageWithAnAbsentEntry } = yield* fixtures;
        expect(replacementOfAPackageWithAnAbsentEntry).toStrictEqual({
          kind: "determinedByItsInput",
        });
      }),
    );
  });
});
