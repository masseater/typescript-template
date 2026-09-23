import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import * as ts from "typescript-6";
import { describe, expect } from "vite-plus/test";

import { readGitSourceScope } from "../git-ignored-source.ts";
import { gitOutput } from "../git-output.ts";
import { buildCatalog, type CanonicalValuesEntry } from "./catalog.ts";
import {
  matchesConfiguredPathAlias,
  repositoryModulePath,
  resolvedDirectImportEntries,
  resolvedPublicImportEntries,
} from "./import-route-resolution.ts";
import { importRouteStatus } from "./import-route.ts";

const ALIASED_TSCONFIG = JSON.stringify({
  compilerOptions: { baseUrl: ".", paths: { "@internal/status": ["src/status.ts"] } },
});

const WILDCARD_TSCONFIG = JSON.stringify({
  compilerOptions: {
    paths: { "@exact": ["src/exact.ts"], "@one/*": ["src/*"], "@two/*/*": ["src/*"] },
  },
});

const VOCABULARY_MANIFEST = JSON.stringify({
  exports: {
    "./status": {
      import: "./fixtures/status.mjs",
      require: "./src/status.cjs",
    },
  },
  name: "@fixture/vocabulary",
  type: "module",
});

const ORDER_STATUS_OWNER: CanonicalValuesEntry = {
  annotationStart: 0,
  binding: "ORDER_STATUSES",
  bindingStart: 40,
  conceptId: "order.status",
  declarationEnd: 80,
  declarationPath: "src/order-status.ts",
  declarationStart: 20,
  fingerprint: "fixture",
  importRoutes: [],
  packageName: null,
  values: ["draft", "published"],
};

const PUBLIC_DECLARATION_OWNER = {
  annotationStart: 0,
  binding: "STATUS",
  bindingStart: 0,
  conceptId: "order.status",
  declarationEnd: 1,
  declarationPath: "src/owner.ts",
  declarationStart: 0,
  fingerprint: "fingerprint",
  importRoutes: [
    {
      exportName: "STATUS",
      resolvedSourcePaths: ["src/runtime.ts"],
      specifier: "./public.d.ts",
    },
  ],
  packageName: null,
  values: ["draft", "published"],
} as const;

const RE_EXPORTED_OWNER = {
  annotationStart: 0,
  binding: "ORDER_STATUSES",
  bindingStart: 0,
  conceptId: "order.status",
  declarationEnd: 1,
  declarationPath: "src/owner.ts",
  declarationStart: 0,
  fingerprint: "fingerprint",
  importRoutes: [
    {
      exportName: "ORDER_STATUSES",
      resolvedSourcePaths: ["src/public.ts"],
      specifier: "./public.ts",
    },
  ],
  packageName: null,
  values: ["draft", "published"],
} as const;

layer(NodeServices.layer)("repositoryModulePath", (it) => {
  describe("a relative specifier written with the TypeScript extension", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* Effect.gen(function* repositoryRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "tsconfig.json"),
          ALIASED_TSCONFIG,
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/consumer.ts"),
          "export {};\n",
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/status.ts"),
          "export const status = 1;\n",
        );
        return repositoryRoot;
      });
      const moduleSourcePath = repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "./status.ts",
      });
      return { repositoryRoot, moduleSourcePath };
    });

    it.effect("names the repository source the extension points at", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const { moduleSourcePath, repositoryRoot } = yield* fixtures;
        expect(moduleSourcePath).toBe(
          yield* filesystem.realPath(pathService.join(repositoryRoot, "src/status.ts")),
        );
      }),
    );
  });

  describe("a relative specifier written without an extension", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* Effect.gen(function* repositoryRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "tsconfig.json"),
          ALIASED_TSCONFIG,
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/consumer.ts"),
          "export {};\n",
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/status.ts"),
          "export const status = 1;\n",
        );
        return repositoryRoot;
      });
      const moduleSourcePath = repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "./status",
      });
      return { repositoryRoot, moduleSourcePath };
    });

    it.effect("names the repository source carrying the TypeScript extension", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const { moduleSourcePath, repositoryRoot } = yield* fixtures;
        expect(moduleSourcePath).toBe(
          yield* filesystem.realPath(pathService.join(repositoryRoot, "src/status.ts")),
        );
      }),
    );
  });

  describe("a relative specifier written with the JavaScript extension", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* Effect.gen(function* repositoryRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "tsconfig.json"),
          ALIASED_TSCONFIG,
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/consumer.ts"),
          "export {};\n",
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/status.ts"),
          "export const status = 1;\n",
        );
        return repositoryRoot;
      });
      const moduleSourcePath = repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "./status.js",
      });
      return { repositoryRoot, moduleSourcePath };
    });

    it.effect("names the TypeScript source the emitted extension stands for", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const { moduleSourcePath, repositoryRoot } = yield* fixtures;
        expect(moduleSourcePath).toBe(
          yield* filesystem.realPath(pathService.join(repositoryRoot, "src/status.ts")),
        );
      }),
    );
  });

  describe("a specifier written as a configured path alias", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* Effect.gen(function* repositoryRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "tsconfig.json"),
          ALIASED_TSCONFIG,
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/consumer.ts"),
          "export {};\n",
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/status.ts"),
          "export const status = 1;\n",
        );
        return repositoryRoot;
      });
      const moduleSourcePath = repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@internal/status",
      });
      return { repositoryRoot, moduleSourcePath };
    });

    it.effect("names the repository source the alias is mapped to", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const { moduleSourcePath, repositoryRoot } = yield* fixtures;
        expect(moduleSourcePath).toBe(
          yield* filesystem.realPath(pathService.join(repositoryRoot, "src/status.ts")),
        );
      }),
    );
  });

  describe("a relative specifier naming no file in the repository", () => {
    const fixture = Effect.gen(function* moduleSourcePath() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        ALIASED_TSCONFIG,
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.ts"),
        "export const status = 1;\n",
      );
      return repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "./missing",
      });
    });

    it.effect("names no repository source", () =>
      Effect.gen(function* program() {
        const moduleSourcePath = yield* fixture;
        expect(moduleSourcePath).toBe(null);
      }),
    );
  });

  describe("a package subpath read in the ECMAScript module resolution mode", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* Effect.gen(function* repositoryRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(
          pathService.join(repositoryRoot, "packages/vocabulary/fixtures"),
          { recursive: true },
        );
        yield* filesystem.makeDirectory(
          pathService.join(repositoryRoot, "packages/vocabulary/src"),
          { recursive: true },
        );
        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "node_modules/@fixture"), {
          recursive: true,
        });
        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "packages/vocabulary/fixtures/status.mjs"),
          'export const status = "fixture";\n',
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "packages/vocabulary/package.json"),
          VOCABULARY_MANIFEST,
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "packages/vocabulary/src/status.cjs"),
          'exports.status = "production";\n',
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/main.cjs"),
          "export {};\n",
        );
        yield* filesystem.symlink(
          pathService.join(repositoryRoot, "packages/vocabulary"),
          pathService.join(repositoryRoot, "node_modules/@fixture/vocabulary"),
        );
        return repositoryRoot;
      });
      const moduleSourcePath = repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/main.cjs"),
        importedName: "status",
        repositoryRoot,
        resolutionMode: ts.ModuleKind.ESNext,
        specifier: "@fixture/vocabulary/status",
      });
      return { repositoryRoot, moduleSourcePath };
    });

    it.effect("names the source the import condition points at", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const { moduleSourcePath, repositoryRoot } = yield* fixtures;
        expect(moduleSourcePath).toBe(
          yield* filesystem.realPath(
            pathService.join(repositoryRoot, "packages/vocabulary/fixtures/status.mjs"),
          ),
        );
      }),
    );
  });

  describe("a package subpath read in the CommonJS resolution mode", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* Effect.gen(function* repositoryRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(
          pathService.join(repositoryRoot, "packages/vocabulary/fixtures"),
          { recursive: true },
        );
        yield* filesystem.makeDirectory(
          pathService.join(repositoryRoot, "packages/vocabulary/src"),
          { recursive: true },
        );
        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "node_modules/@fixture"), {
          recursive: true,
        });
        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "packages/vocabulary/fixtures/status.mjs"),
          'export const status = "fixture";\n',
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "packages/vocabulary/package.json"),
          VOCABULARY_MANIFEST,
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "packages/vocabulary/src/status.cjs"),
          'exports.status = "production";\n',
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/main.cjs"),
          "export {};\n",
        );
        yield* filesystem.symlink(
          pathService.join(repositoryRoot, "packages/vocabulary"),
          pathService.join(repositoryRoot, "node_modules/@fixture/vocabulary"),
        );
        return repositoryRoot;
      });
      const moduleSourcePath = repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/main.cjs"),
        importedName: "status",
        repositoryRoot,
        resolutionMode: ts.ModuleKind.CommonJS,
        specifier: "@fixture/vocabulary/status",
      });
      return { repositoryRoot, moduleSourcePath };
    });

    it.effect("names the source the require condition points at", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const { moduleSourcePath, repositoryRoot } = yield* fixtures;
        expect(moduleSourcePath).toBe(
          yield* filesystem.realPath(
            pathService.join(repositoryRoot, "packages/vocabulary/src/status.cjs"),
          ),
        );
      }),
    );
  });

  describe("a file URL naming a repository source", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* Effect.gen(function* repositoryRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/consumer.ts"),
          "export {};\n",
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/status.ts"),
          "export const status = 1;\n",
        );
        return repositoryRoot;
      });
      const moduleSourcePath = repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: new URL(`file://${pathService.join(repositoryRoot, "src/status.ts")}`).href,
      });
      return { repositoryRoot, moduleSourcePath };
    });

    it.effect("names the repository source the URL points at", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const { moduleSourcePath, repositoryRoot } = yield* fixtures;
        expect(moduleSourcePath).toBe(
          yield* filesystem.realPath(pathService.join(repositoryRoot, "src/status.ts")),
        );
      }),
    );
  });

  describe("a file URL that cannot be read as a path", () => {
    const fixture = Effect.gen(function* moduleSourcePath() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.ts"),
        "export const status = 1;\n",
      );
      return repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "file:%",
      });
    });

    it.effect("names no repository source", () =>
      Effect.gen(function* program() {
        const moduleSourcePath = yield* fixture;
        expect(moduleSourcePath).toBe(null);
      }),
    );
  });

  describe("a file URL naming a path outside the repository", () => {
    const fixture = Effect.gen(function* moduleSourcePath() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.ts"),
        "export const status = 1;\n",
      );
      return repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "file:///vendor/status.ts",
      });
    });

    it.effect("names no repository source", () =>
      Effect.gen(function* program() {
        const moduleSourcePath = yield* fixture;
        expect(moduleSourcePath).toBe(null);
      }),
    );
  });

  describe("a specifier naming a Node builtin", () => {
    const fixture = Effect.gen(function* moduleSourcePath() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.ts"),
        "export const status = 1;\n",
      );
      return repositoryModulePath({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "node:fs",
      });
    });

    it.effect("names no repository source", () =>
      Effect.gen(function* program() {
        const moduleSourcePath = yield* fixture;
        expect(moduleSourcePath).toBe(null);
      }),
    );
  });

  describe("a relative specifier read under unparsable compiler configuration", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const repositoryRoot = yield* Effect.gen(function* repositoryRoot() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "tsconfig.json"),
          "{ invalid",
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/consumer.ts"),
          "export {};\n",
        );
        yield* filesystem.writeFileString(
          pathService.join(repositoryRoot, "src/status.ts"),
          "export const status = 1;\n",
        );
        return repositoryRoot;
      });
      const moduleSourcePath = repositoryModulePath({
        filename: "src/consumer.ts",
        importedName: "status",
        repositoryRoot,
        specifier: "./status.ts",
      });
      return { repositoryRoot, moduleSourcePath };
    });

    it.effect("still names the repository source the specifier points at", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;
        const { moduleSourcePath, repositoryRoot } = yield* fixtures;
        expect(moduleSourcePath).toBe(
          yield* filesystem.realPath(pathService.join(repositoryRoot, "src/status.ts")),
        );
      }),
    );
  });

  describe("a specifier naming an installed dependency", () => {
    const fixture = Effect.gen(function* moduleSourcePath() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "node_modules/dependency"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "node_modules/dependency/index.d.ts"),
        "export const status: string;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "node_modules/dependency/package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "dependency",
          types: "index.d.ts",
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      return repositoryModulePath({
        filename: "src/consumer.ts",
        importedName: "status",
        repositoryRoot,
        specifier: "dependency",
      });
    });

    it.effect("names no repository source", () =>
      Effect.gen(function* program() {
        const moduleSourcePath = yield* fixture;
        expect(moduleSourcePath).toBe(null);
      }),
    );
  });

  describe("a consumer file lying outside the repository", () => {
    const fixture = Effect.gen(function* moduleSourcePath() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      return repositoryModulePath({
        filename: pathService.join(pathService.dirname(repositoryRoot), "consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "./status.ts",
      });
    });

    it.effect("names no repository source", () =>
      Effect.gen(function* program() {
        const moduleSourcePath = yield* fixture;
        expect(moduleSourcePath).toBe(null);
      }),
    );
  });
});

layer(NodeServices.layer)("matchesConfiguredPathAlias", (it) => {
  describe("a configured pattern carrying no wildcard", () => {
    const fixture = Effect.gen(function* configuredAliasMatch() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        WILDCARD_TSCONFIG,
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      return matchesConfiguredPathAlias({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@exact",
      });
    });

    it.effect("claims the specifier that spells the pattern out", () =>
      Effect.gen(function* program() {
        const configuredAliasMatch = yield* fixture;
        expect(configuredAliasMatch).toBe(true);
      }),
    );
  });

  describe("a configured pattern carrying one wildcard met by one segment", () => {
    const fixture = Effect.gen(function* configuredAliasMatch() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        WILDCARD_TSCONFIG,
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      return matchesConfiguredPathAlias({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@one/status",
      });
    });

    it.effect("claims the specifier the wildcard covers", () =>
      Effect.gen(function* program() {
        const configuredAliasMatch = yield* fixture;
        expect(configuredAliasMatch).toBe(true);
      }),
    );
  });

  describe("a configured pattern carrying one wildcard met by several segments", () => {
    const fixture = Effect.gen(function* configuredAliasMatch() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        WILDCARD_TSCONFIG,
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      return matchesConfiguredPathAlias({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@one/status/extra",
      });
    });

    it.effect("lets the wildcard reach across the segment boundary", () =>
      Effect.gen(function* program() {
        const configuredAliasMatch = yield* fixture;
        expect(configuredAliasMatch).toBe(true);
      }),
    );
  });

  describe("a configured pattern carrying two wildcards", () => {
    const fixture = Effect.gen(function* configuredAliasMatch() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        WILDCARD_TSCONFIG,
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      return matchesConfiguredPathAlias({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@two/a/b",
      });
    });

    it.effect("claims nothing, because a pattern may carry only one wildcard", () =>
      Effect.gen(function* program() {
        const configuredAliasMatch = yield* fixture;
        expect(configuredAliasMatch).toBe(false);
      }),
    );
  });

  describe("a specifier meeting none of the configured patterns", () => {
    const fixture = Effect.gen(function* configuredAliasMatch() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        WILDCARD_TSCONFIG,
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      return matchesConfiguredPathAlias({
        filename: pathService.join(repositoryRoot, "src/consumer.ts"),
        importedName: "status",
        repositoryRoot,
        specifier: "@other/status",
      });
    });

    it.effect("claims nothing", () =>
      Effect.gen(function* program() {
        const configuredAliasMatch = yield* fixture;
        expect(configuredAliasMatch).toBe(false);
      }),
    );
  });

  describe("a specifier read under unparsable compiler configuration", () => {
    const fixture = Effect.gen(function* configuredAliasMatch() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        "{ invalid",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.ts"),
        "export const status = 1;\n",
      );
      return matchesConfiguredPathAlias({
        filename: "src/consumer.ts",
        importedName: "status",
        repositoryRoot,
        specifier: "./status.ts",
      });
    });

    it.effect("claims nothing, because no pattern was read", () =>
      Effect.gen(function* program() {
        const configuredAliasMatch = yield* fixture;
        expect(configuredAliasMatch).toBe(false);
      }),
    );
  });
});

layer(NodeServices.layer)("importRouteStatus", (it) => {
  describe("an ignored source that git does not track", () => {
    const fixture = Effect.gen(function* routeStatus() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "ignored"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, ".gitignore"),
        "ignored\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "ignored/status.ts"),
        "export const status = 1;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      return importRouteStatus(
        {
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          importedName: "status",
          repositoryRoot,
          specifier: "../ignored/status.ts",
        },
        buildCatalog([], {
          sourceScope: { isIgnored: (sourcePath) => sourcePath.includes("/ignored/") },
        }),
      );
    });

    it.effect("stands outside the repository", () =>
      Effect.gen(function* program() {
        const routeStatus = yield* fixture;
        expect(routeStatus).toBe("external");
      }),
    );
  });

  describe("the same ignored source once git tracks it", () => {
    const fixture = Effect.gen(function* routeStatus() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "ignored"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, ".gitignore"),
        "ignored\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "ignored/status.ts"),
        "export const status = 1;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      gitOutput(["add", "-f", "ignored/status.ts"], { cwd: repositoryRoot, env: process.env });
      return importRouteStatus(
        {
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          importedName: "status",
          repositoryRoot,
          specifier: "../ignored/status.ts",
        },
        buildCatalog([]),
      );
    });

    it.effect("counts as repository code that no catalog entry claims", () =>
      Effect.gen(function* program() {
        const routeStatus = yield* fixture;
        expect(routeStatus).toBe("unregistered");
      }),
    );
  });

  describe("a registered owner reached through an ignored symbolic link", () => {
    const fixture = Effect.gen(function* routeStatus() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, ".gitignore"),
        "ignored\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/schema.ts"),
        "export {};\n",
      );
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      yield* filesystem.symlink("src", pathService.join(repositoryRoot, "ignored"));
      return importRouteStatus(
        {
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "../ignored/order-status.ts",
        },
        buildCatalog([ORDER_STATUS_OWNER], {
          sourceScope: readGitSourceScope(repositoryRoot),
        }),
      );
    });

    it.effect("stands outside the repository instead of reaching the owner", () =>
      Effect.gen(function* program() {
        const routeStatus = yield* fixture;
        expect(routeStatus).toBe("external");
      }),
    );
  });

  describe("a registered owner reached through its own path", () => {
    const fixture = Effect.gen(function* routeStatus() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, ".gitignore"),
        "ignored\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/schema.ts"),
        "export {};\n",
      );
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      yield* filesystem.symlink("src", pathService.join(repositoryRoot, "ignored"));
      return importRouteStatus(
        {
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./order-status.ts",
        },
        buildCatalog([ORDER_STATUS_OWNER], {
          sourceScope: readGitSourceScope(repositoryRoot),
        }),
      );
    });

    it.effect("reaches the catalog entry that owns the binding", () =>
      Effect.gen(function* program() {
        const routeStatus = yield* fixture;
        expect(routeStatus).toBe("registered");
      }),
    );
  });

  describe("a registered owner reached through a linked dependency path", () => {
    const fixture = Effect.gen(function* routeStatus() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "node_modules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/order-status.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/schema.ts"),
        "export {};\n",
      );
      yield* filesystem.symlink("../src", pathService.join(repositoryRoot, "node_modules/owner"));
      return importRouteStatus(
        {
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "../node_modules/owner/order-status.ts",
        },
        buildCatalog([ORDER_STATUS_OWNER], {
          sourceScope: { isIgnored: (sourcePath) => sourcePath.includes("/node_modules/") },
        }),
      );
    });

    it.effect("keeps the physical owner identity behind the link", () =>
      Effect.gen(function* program() {
        const routeStatus = yield* fixture;
        expect(routeStatus).toBe("registered");
      }),
    );
  });
});

layer(NodeServices.layer)("resolvedPublicImportEntries", (it) => {
  describe("a public declaration file exporting the imported runtime name", () => {
    const fixture = Effect.gen(function* publicOwnerEntries() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/public.d.ts"),
        "interface Local {}\ndeclare const LOCAL: string;\nexport const STATUS: string;\n",
      );
      return resolvedPublicImportEntries(
        {
          filename: "src/consumer.ts",
          importedName: "STATUS",
          repositoryRoot,
          specifier: "./public.d.ts",
        },
        [PUBLIC_DECLARATION_OWNER],
      );
    });

    it.effect("hands back the owner the declaration file publishes", () =>
      Effect.gen(function* program() {
        const publicOwnerEntries = yield* fixture;
        expect(publicOwnerEntries).toStrictEqual([PUBLIC_DECLARATION_OWNER]);
      }),
    );
  });

  describe("a public declaration file missing the imported runtime name", () => {
    const fixture = Effect.gen(function* publicOwnerEntries() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/public.d.ts"),
        "interface Local {}\ndeclare const LOCAL: string;\nexport const STATUS: string;\n",
      );
      return resolvedPublicImportEntries(
        {
          filename: "src/consumer.ts",
          importedName: "MISSING",
          repositoryRoot,
          specifier: "./public.d.ts",
        },
        [PUBLIC_DECLARATION_OWNER],
      );
    });

    it.effect("hands back no owner", () =>
      Effect.gen(function* program() {
        const publicOwnerEntries = yield* fixture;
        expect(publicOwnerEntries).toStrictEqual([]);
      }),
    );
  });

  describe("a specifier naming a Node builtin instead of a declaration file", () => {
    const fixture = Effect.gen(function* publicOwnerEntries() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/public.d.ts"),
        "interface Local {}\ndeclare const LOCAL: string;\nexport const STATUS: string;\n",
      );
      return resolvedPublicImportEntries(
        {
          filename: "src/consumer.ts",
          importedName: "STATUS",
          repositoryRoot,
          specifier: "node:fs",
        },
        [PUBLIC_DECLARATION_OWNER],
      );
    });

    it.effect("hands back no owner", () =>
      Effect.gen(function* program() {
        const publicOwnerEntries = yield* fixture;
        expect(publicOwnerEntries).toStrictEqual([]);
      }),
    );
  });

  describe("a public module re-exporting the owner binding", () => {
    const fixture = Effect.gen(function* publicOwnerEntries() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
      );
      return resolvedPublicImportEntries(
        {
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./public.ts",
        },
        [RE_EXPORTED_OWNER],
      );
    });

    it.effect("hands back the owner the public module re-exports", () =>
      Effect.gen(function* program() {
        const publicOwnerEntries = yield* fixture;
        expect(publicOwnerEntries).toStrictEqual([RE_EXPORTED_OWNER]);
      }),
    );
  });

  describe("an imported name the public module does not export", () => {
    const fixture = Effect.gen(function* publicOwnerEntries() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
      );
      return resolvedPublicImportEntries(
        {
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          importedName: "SHADOW",
          repositoryRoot,
          specifier: "./public.ts",
        },
        [RE_EXPORTED_OWNER],
      );
    });

    it.effect("hands back no owner", () =>
      Effect.gen(function* program() {
        const publicOwnerEntries = yield* fixture;
        expect(publicOwnerEntries).toStrictEqual([]);
      }),
    );
  });

  describe("an owner route whose resolved sources name another module", () => {
    const fixture = Effect.gen(function* publicOwnerEntries() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
      );
      return resolvedPublicImportEntries(
        {
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./public.ts",
        },
        [
          {
            ...RE_EXPORTED_OWNER,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["src/runtime.ts"],
                specifier: "./public.ts",
              },
            ],
          },
        ],
      );
    });

    it.effect("hands back no owner", () =>
      Effect.gen(function* program() {
        const publicOwnerEntries = yield* fixture;
        expect(publicOwnerEntries).toStrictEqual([]);
      }),
    );
  });
});

layer(NodeServices.layer)("resolvedDirectImportEntries", (it) => {
  describe("a specifier naming the owner module", () => {
    const fixture = Effect.gen(function* directOwnerEntries() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
      );
      return resolvedDirectImportEntries(
        {
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./owner.ts",
        },
        [RE_EXPORTED_OWNER],
      );
    });

    it.effect("hands back the owner declared in that module", () =>
      Effect.gen(function* program() {
        const directOwnerEntries = yield* fixture;
        expect(directOwnerEntries).toStrictEqual([RE_EXPORTED_OWNER]);
      }),
    );
  });

  describe("a specifier naming no repository module", () => {
    const fixture = Effect.gen(function* directOwnerEntries() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/owner.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/public.ts"),
        'export { ORDER_STATUSES } from "./owner.ts";\n',
      );
      return resolvedDirectImportEntries(
        {
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          importedName: "ORDER_STATUSES",
          repositoryRoot,
          specifier: "./missing.ts",
        },
        [RE_EXPORTED_OWNER],
      );
    });

    it.effect("hands back no owner", () =>
      Effect.gen(function* program() {
        const directOwnerEntries = yield* fixture;
        expect(directOwnerEntries).toStrictEqual([]);
      }),
    );
  });
});
