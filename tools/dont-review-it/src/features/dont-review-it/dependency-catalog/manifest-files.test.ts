import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { readWorkspaceManifests } from "./manifest-files.ts";

layer(NodeServices.layer)("readWorkspaceManifests", (it) => {
  describe("a star pattern over a directory that holds two packages", () => {
    const manifestsOfTheRootAndBothPackagesFixture = Effect.gen(
      function* manifestsOfTheRootAndBothPackages() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-manifest-files-",
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{"name": "root"}`,
        );
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "left"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "left", "package.json"),
          `{"name": "left"}`,
        );
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "right"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "right", "package.json"),
          `{"name": "right"}`,
        );
        return yield* readWorkspaceManifests({
          repositoryRoot,
          packagePatterns: ["packages/*"],
          config: defaultDependencyCatalogChecksConfig,
        });
      },
    );

    it.effect("reads the root manifest and every manifest the pattern reaches", () =>
      Effect.gen(function* program() {
        const manifestsOfTheRootAndBothPackages = yield* manifestsOfTheRootAndBothPackagesFixture;
        expect(manifestsOfTheRootAndBothPackages).toStrictEqual([
          { relativePath: "package.json", manifest: { name: "root" } },
          { relativePath: "packages/left/package.json", manifest: { name: "left" } },
          { relativePath: "packages/right/package.json", manifest: { name: "right" } },
        ]);
      }),
    );
  });

  describe("a pattern that carries no star", () => {
    const manifestsOfTheRootAndTheNamedDirectoryFixture = Effect.gen(
      function* manifestsOfTheRootAndTheNamedDirectory() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-manifest-files-",
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{"name": "root"}`,
        );
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "docs"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "docs", "package.json"),
          `{"name": "docs"}`,
        );
        return yield* readWorkspaceManifests({
          repositoryRoot,
          packagePatterns: ["docs"],
          config: defaultDependencyCatalogChecksConfig,
        });
      },
    );

    it.effect("reads it as a directory name", () =>
      Effect.gen(function* program() {
        const manifestsOfTheRootAndTheNamedDirectory =
          yield* manifestsOfTheRootAndTheNamedDirectoryFixture;
        expect(manifestsOfTheRootAndTheNamedDirectory).toStrictEqual([
          { relativePath: "package.json", manifest: { name: "root" } },
          { relativePath: "docs/package.json", manifest: { name: "docs" } },
        ]);
      }),
    );
  });

  describe("a negated pattern", () => {
    const manifestsLeftBesideTheNegatedPackageFixture = Effect.gen(
      function* manifestsLeftBesideTheNegatedPackage() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-manifest-files-",
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{"name": "root"}`,
        );
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "left"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "left", "package.json"),
          `{"name": "left"}`,
        );
        return yield* readWorkspaceManifests({
          repositoryRoot,
          packagePatterns: ["!packages/left"],
          config: defaultDependencyCatalogChecksConfig,
        });
      },
    );

    it.effect("skips it instead of guessing what it removes", () =>
      Effect.gen(function* program() {
        const manifestsLeftBesideTheNegatedPackage =
          yield* manifestsLeftBesideTheNegatedPackageFixture;
        expect(manifestsLeftBesideTheNegatedPackage).toStrictEqual([
          { relativePath: "package.json", manifest: { name: "root" } },
        ]);
      }),
    );
  });

  describe("a star pattern whose parent directory is missing", () => {
    const manifestsOfARepositoryWithoutThatParentDirectoryFixture = Effect.gen(
      function* manifestsOfARepositoryWithoutThatParentDirectory() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-manifest-files-",
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{"name": "root"}`,
        );
        return yield* readWorkspaceManifests({
          repositoryRoot,
          packagePatterns: ["packages/*"],
          config: defaultDependencyCatalogChecksConfig,
        });
      },
    );

    it.effect("reads no manifest beyond the root", () =>
      Effect.gen(function* program() {
        const manifestsOfARepositoryWithoutThatParentDirectory =
          yield* manifestsOfARepositoryWithoutThatParentDirectoryFixture;
        expect(manifestsOfARepositoryWithoutThatParentDirectory).toStrictEqual([
          { relativePath: "package.json", manifest: { name: "root" } },
        ]);
      }),
    );
  });

  describe("a file sitting between the package directories", () => {
    const manifestsBesideThatFileFixture = Effect.gen(function* manifestsBesideThatFile() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-manifest-files-",
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{"name": "root"}`,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "left"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "README.md"),
        "packages",
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "left", "package.json"),
        `{"name": "left"}`,
      );
      return yield* readWorkspaceManifests({
        repositoryRoot,
        packagePatterns: ["packages/*"],
        config: defaultDependencyCatalogChecksConfig,
      });
    });

    it.effect("leaves it alone", () =>
      Effect.gen(function* program() {
        const manifestsBesideThatFile = yield* manifestsBesideThatFileFixture;
        expect(manifestsBesideThatFile).toStrictEqual([
          { relativePath: "package.json", manifest: { name: "root" } },
          { relativePath: "packages/left/package.json", manifest: { name: "left" } },
        ]);
      }),
    );
  });

  describe("a pattern that names the repository root itself", () => {
    const manifestsOfTheRootNamedTwiceFixture = Effect.gen(
      function* manifestsOfTheRootNamedTwice() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-manifest-files-",
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{"name": "root"}`,
        );
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "left"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "left", "package.json"),
          `{"name": "left"}`,
        );
        return yield* readWorkspaceManifests({
          repositoryRoot,
          packagePatterns: [".", "packages/*"],
          config: defaultDependencyCatalogChecksConfig,
        });
      },
    );

    it.effect("counts the root manifest once", () =>
      Effect.gen(function* program() {
        const manifestsOfTheRootNamedTwice = yield* manifestsOfTheRootNamedTwiceFixture;
        expect(manifestsOfTheRootNamedTwice).toStrictEqual([
          { relativePath: "package.json", manifest: { name: "root" } },
          { relativePath: "packages/left/package.json", manifest: { name: "left" } },
        ]);
      }),
    );
  });

  describe("a package directory that carries no manifest", () => {
    const manifestsBesideTheDirectoryWithoutAManifestFixture = Effect.gen(
      function* manifestsBesideTheDirectoryWithoutAManifest() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-manifest-files-",
        });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "empty"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "empty", ".gitkeep"),
          "",
        );
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "left"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "left", "package.json"),
          `{"name": "left"}`,
        );
        return yield* readWorkspaceManifests({
          repositoryRoot,
          packagePatterns: ["packages/*"],
          config: defaultDependencyCatalogChecksConfig,
        });
      },
    );

    it.effect("skips it", () =>
      Effect.gen(function* program() {
        const manifestsBesideTheDirectoryWithoutAManifest =
          yield* manifestsBesideTheDirectoryWithoutAManifestFixture;
        expect(manifestsBesideTheDirectoryWithoutAManifest).toStrictEqual([
          { relativePath: "packages/left/package.json", manifest: { name: "left" } },
        ]);
      }),
    );
  });

  describe("a package manifest that does not parse as JSON", () => {
    const unparsableManifestFixture = Effect.gen(function* unparsableManifest() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-manifest-files-",
      });
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "left"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "left", "package.json"),
        `{"name": `,
      );
      const failure = yield* Effect.flip(
        readWorkspaceManifests({
          repositoryRoot,
          packagePatterns: ["packages/*"],
          config: defaultDependencyCatalogChecksConfig,
        }),
      );
      return {
        failure:
          failure._tag === "ManifestUnparsable"
            ? { _tag: failure._tag, file: failure.file }
            : failure,
        file: paths.join(repositoryRoot, "packages", "left", "package.json"),
      };
    });

    it.effect("fails naming the manifest", () =>
      Effect.gen(function* program() {
        const { failure, file } = yield* unparsableManifestFixture;
        expect(failure).toStrictEqual({ _tag: "ManifestUnparsable", file });
      }),
    );
  });
});
