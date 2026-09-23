import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { runDependencyCatalogChecks } from "./run-dependency-catalog-checks.ts";

layer(NodeServices.layer)("runDependencyCatalogChecks", (it) => {
  describe("a repository where no workspace definition marks pnpm usage", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("stays silent and says the definition is missing", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          warnings: [],
          definitionUnreadable: false,
          definitionMissing: true,
          scanned: 0,
        });
      }),
    );
  });

  describe("a workspace definition that does not parse", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages: [\n",
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("is the one problem, reported against the definition itself", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "pnpm-workspace.yaml",
              line: null,
              message:
                "A workspace definition that does not parse must not stay in the repository, because every dependency check reads it as an empty file and reports nothing. Fix the YAML here so the definition can be read.",
            },
          ],
          warnings: [],
          definitionUnreadable: true,
          definitionMissing: false,
          scanned: 0,
        });
      }),
    );
  });

  describe("a catalog entry that only one manifest uses", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{"name": "root"}`,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("is reported with the manifest that is its only user named", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "pnpm-workspace.yaml",
              line: null,
              message:
                "The catalog must not hold react while packages/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^19.0.0 into that manifest and delete the entry.",
            },
          ],
          warnings: [],
          definitionUnreadable: false,
          definitionMissing: false,
          scanned: 2,
        });
      }),
    );
  });

  describe("a catalog entry that a workspace override references", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        `packages:\n  - packages/*\ncatalog:\n  vite: ^6.0.0\noverrides:\n  vite: "catalog:"\n`,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"vite": "catalog:"}}`,
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("stays quiet even though a single manifest uses it", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          warnings: [],
          definitionUnreadable: false,
          definitionMissing: false,
          scanned: 1,
        });
      }),
    );
  });

  describe("a catalog entry that a root manifest override references", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  vite: ^6.0.0\n",
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{"pnpm": {"overrides": {"vite": "catalog:"}}}`,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"vite": "catalog:"}}`,
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("stays quiet even though a single manifest uses it", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          warnings: [],
          definitionUnreadable: false,
          definitionMissing: false,
          scanned: 2,
        });
      }),
    );
  });

  describe("a catalog entry whose only user pins the version directly", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("tells that manifest to inline the entry rather than to reference it", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "pnpm-workspace.yaml",
              line: null,
              message:
                "The catalog must not hold react while packages/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^19.0.0 into that manifest and delete the entry.",
            },
          ],
          warnings: [],
          definitionUnreadable: false,
          definitionMissing: false,
          scanned: 1,
        });
      }),
    );
  });

  describe("a second manifest that pins the version the catalog already holds", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:"}}`,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "site"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "site", "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("is told to reference the catalog instead", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "packages/site/package.json",
              line: null,
              message:
                "react must not carry ^19.0.0 directly while the catalog already pins that version. Replace the specifier with catalog: so one declaration keeps the version.",
            },
          ],
          warnings: [],
          definitionUnreadable: false,
          definitionMissing: false,
          scanned: 2,
        });
      }),
    );
  });

  describe("a version that two manifests pin outside the catalog", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{"devDependencies": {"typescript": "^5.0.0"}}`,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "site"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "site", "package.json"),
        `{"devDependencies": {"typescript": "^5.0.0"}}`,
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("is asked to move into the catalog", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "pnpm-workspace.yaml",
              line: null,
              message:
                "typescript must not be pinned to ^5.0.0 separately by packages/site/package.json and packages/web/package.json, because pins that repeat drift apart silently. Add typescript to the catalog and reference it with catalog: from each manifest.",
            },
          ],
          warnings: [],
          definitionUnreadable: false,
          definitionMissing: false,
          scanned: 2,
        });
      }),
    );
  });

  describe("two manifests whose pinned versions disagree", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{"devDependencies": {"typescript": "^5.0.0"}}`,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "site"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "site", "package.json"),
        `{"devDependencies": {"typescript": "^5.5.0"}}`,
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("are handed back as a warning without failing anything", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          warnings: [
            {
              file: "pnpm-workspace.yaml",
              line: null,
              message:
                "typescript is pinned to different specifiers: packages/site/package.json pins ^5.5.0, packages/web/package.json pins ^5.0.0. Decide one version, then move it to the catalog once the manifests agree.",
            },
          ],
          definitionUnreadable: false,
          definitionMissing: false,
          scanned: 2,
        });
      }),
    );
  });

  describe("findings that several checks raised at once", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-catalog-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n  zod: ^4.0.0\n  axios: ^1.0.0\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{"dependencies": {"react": "catalog:", "zod": "catalog:", "axios": "catalog:"}}`,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "site"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "site", "package.json"),
        `{"dependencies": {"react": "^19.0.0"}}`,
      );
      return yield* runDependencyCatalogChecks({
        repositoryRoot,
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("are ordered by file and then by message", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "packages/site/package.json",
              line: null,
              message:
                "react must not carry ^19.0.0 directly while the catalog already pins that version. Replace the specifier with catalog: so one declaration keeps the version.",
            },
            {
              file: "pnpm-workspace.yaml",
              line: null,
              message:
                "The catalog must not hold axios while packages/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^1.0.0 into that manifest and delete the entry.",
            },
            {
              file: "pnpm-workspace.yaml",
              line: null,
              message:
                "The catalog must not hold zod while packages/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^4.0.0 into that manifest and delete the entry.",
            },
          ],
          warnings: [],
          definitionUnreadable: false,
          definitionMissing: false,
          scanned: 2,
        });
      }),
    );
  });
});
