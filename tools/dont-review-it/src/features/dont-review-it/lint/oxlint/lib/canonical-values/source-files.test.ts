import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { readGitSourceScope } from "../git-ignored-source.ts";
import { gitOutput } from "../git-output.ts";
import { listRepositoryFiles, nearestPackageDirectory } from "./source-files.ts";

layer(NodeServices.layer)("listRepositoryFiles", (it) => {
  describe("an entry the directory lists but the file system cannot reach", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const unreachableTargetRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-unreachable-target-",
      });
      const commentSourcePathsBesideALinkToNothing = yield* Effect.gen(
        function* commentSourcePathsBesideALinkToNothing() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(pathService.join(unreachableTargetRoot, "src"), {
            recursive: true,
          });

          yield* filesystem.writeFileString(
            pathService.join(unreachableTargetRoot, "src", "present.ts"),
            "export const total = 1;\n",
          );
          yield* filesystem.symlink(
            pathService.join(unreachableTargetRoot, "src", "removed.ts"),
            pathService.join(unreachableTargetRoot, "src", "gone.ts"),
          );
          return listRepositoryFiles(unreachableTargetRoot).commentSources.map(
            (file) => file.relativePath,
          );
        },
      );
      return { unreachableTargetRoot, commentSourcePathsBesideALinkToNothing };
    });

    it.effect("is left out", () =>
      Effect.gen(function* program() {
        const { commentSourcePathsBesideALinkToNothing } = yield* fixtures;
        expect(commentSourcePathsBesideALinkToNothing).toStrictEqual(["src/present.ts"]);
      }),
    );
  });

  describe("an entry that resolves to a directory", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const directoryTargetRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-directory-target-",
      });
      const commentSourcePathsBesideALinkToADirectory = yield* Effect.gen(
        function* commentSourcePathsBesideALinkToADirectory() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(pathService.join(directoryTargetRoot, "src", "nested"), {
            recursive: true,
          });

          yield* filesystem.writeFileString(
            pathService.join(directoryTargetRoot, "src", "present.ts"),
            "export const total = 1;\n",
          );
          yield* filesystem.symlink(
            pathService.join(directoryTargetRoot, "src", "nested"),
            pathService.join(directoryTargetRoot, "src", "linked.ts"),
          );
          return listRepositoryFiles(directoryTargetRoot).commentSources.map(
            (file) => file.relativePath,
          );
        },
      );
      return { directoryTargetRoot, commentSourcePathsBesideALinkToADirectory };
    });

    it.effect("is left out of the listing", () =>
      Effect.gen(function* program() {
        const { commentSourcePathsBesideALinkToADirectory } = yield* fixtures;
        expect(commentSourcePathsBesideALinkToADirectory).toStrictEqual(["src/present.ts"]);
      }),
    );
  });

  describe("a script standing beside a style sheet and a markup file", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const mixedAssetScriptsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-mixed-assets-scripts-",
      });
      const commentSourcePathsBesideAssets = yield* Effect.gen(
        function* commentSourcePathsBesideAssets() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(pathService.join(mixedAssetScriptsRoot, "src"), {
            recursive: true,
          });

          yield* filesystem.writeFileString(
            pathService.join(mixedAssetScriptsRoot, "package.json"),
            "{}",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetScriptsRoot, "src", "order.ts"),
            "export const total = 1;\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetScriptsRoot, "src", "order.css"),
            ".total {\n  color: red;\n}\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetScriptsRoot, "src", "icon.svg"),
            "<svg></svg>\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetScriptsRoot, "index.html"),
            "<div></div>\n",
          );
          return listRepositoryFiles(mixedAssetScriptsRoot).commentSources.map(
            (file) => file.relativePath,
          );
        },
      );
      return { mixedAssetScriptsRoot, commentSourcePathsBesideAssets };
    });

    it.effect("is listed as a script", () =>
      Effect.gen(function* program() {
        const { commentSourcePathsBesideAssets } = yield* fixtures;
        expect(commentSourcePathsBesideAssets).toStrictEqual(["src/order.ts"]);
      }),
    );
  });

  describe("a style sheet standing beside a script", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const mixedAssetStylesRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-mixed-assets-styles-",
      });
      const styleSheetPathsBesideScripts = yield* Effect.gen(
        function* styleSheetPathsBesideScripts() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(pathService.join(mixedAssetStylesRoot, "src"), {
            recursive: true,
          });

          yield* filesystem.writeFileString(
            pathService.join(mixedAssetStylesRoot, "package.json"),
            "{}",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetStylesRoot, "src", "order.ts"),
            "export const total = 1;\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetStylesRoot, "src", "order.css"),
            ".total {\n  color: red;\n}\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetStylesRoot, "src", "icon.svg"),
            "<svg></svg>\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetStylesRoot, "index.html"),
            "<div></div>\n",
          );
          return listRepositoryFiles(mixedAssetStylesRoot).styleSheets.map(
            (file) => file.relativePath,
          );
        },
      );
      return { mixedAssetStylesRoot, styleSheetPathsBesideScripts };
    });

    it.effect("is listed apart from the scripts", () =>
      Effect.gen(function* program() {
        const { styleSheetPathsBesideScripts } = yield* fixtures;
        expect(styleSheetPathsBesideScripts).toStrictEqual(["src/order.css"]);
      }),
    );
  });

  describe("a markup file standing beside a script", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const mixedAssetMarkupRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-mixed-assets-markup-",
      });
      const markupSourcePathsBesideScripts = yield* Effect.gen(
        function* markupSourcePathsBesideScripts() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(pathService.join(mixedAssetMarkupRoot, "src"), {
            recursive: true,
          });

          yield* filesystem.writeFileString(
            pathService.join(mixedAssetMarkupRoot, "package.json"),
            "{}",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetMarkupRoot, "src", "order.ts"),
            "export const total = 1;\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetMarkupRoot, "src", "order.css"),
            ".total {\n  color: red;\n}\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetMarkupRoot, "src", "icon.svg"),
            "<svg></svg>\n",
          );
          yield* filesystem.writeFileString(
            pathService.join(mixedAssetMarkupRoot, "index.html"),
            "<div></div>\n",
          );
          return listRepositoryFiles(mixedAssetMarkupRoot).markupSources.map(
            (file) => file.relativePath,
          );
        },
      );
      return { mixedAssetMarkupRoot, markupSourcePathsBesideScripts };
    });

    it.effect("is listed apart from the scripts", () =>
      Effect.gen(function* program() {
        const { markupSourcePathsBesideScripts } = yield* fixtures;
        expect(markupSourcePathsBesideScripts).toStrictEqual(["index.html", "src/icon.svg"]);
      }),
    );
  });

  describe("a manifest standing beside a script", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const mixedAssetManifestsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-mixed-assets-manifests-",
      });
      const manifestPathsBesideScripts = yield* Effect.gen(function* manifestPathsBesideScripts() {
        const filesystem = yield* FileSystem.FileSystem;
        const pathService = yield* Path.Path;

        yield* filesystem.makeDirectory(pathService.join(mixedAssetManifestsRoot, "src"), {
          recursive: true,
        });

        yield* filesystem.writeFileString(
          pathService.join(mixedAssetManifestsRoot, "package.json"),
          "{}",
        );
        yield* filesystem.writeFileString(
          pathService.join(mixedAssetManifestsRoot, "src", "order.ts"),
          "export const total = 1;\n",
        );
        yield* filesystem.writeFileString(
          pathService.join(mixedAssetManifestsRoot, "src", "order.css"),
          ".total {\n  color: red;\n}\n",
        );
        yield* filesystem.writeFileString(
          pathService.join(mixedAssetManifestsRoot, "src", "icon.svg"),
          "<svg></svg>\n",
        );
        yield* filesystem.writeFileString(
          pathService.join(mixedAssetManifestsRoot, "index.html"),
          "<div></div>\n",
        );
        return listRepositoryFiles(mixedAssetManifestsRoot).manifests.map(
          (file) => file.relativePath,
        );
      });
      return { mixedAssetManifestsRoot, manifestPathsBesideScripts };
    });

    it.effect("is listed apart from the scripts", () =>
      Effect.gen(function* program() {
        const { manifestPathsBesideScripts } = yield* fixtures;
        expect(manifestPathsBesideScripts).toStrictEqual(["package.json"]);
      }),
    );
  });

  describe("production sources standing beside tests, stories, fixtures, and declarations", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationSourcePathsBesideNonProductionScripts = yield* Effect.gen(
        function* declarationSourcePathsBesideNonProductionScripts() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          for (const relativePath of [
            "src/order-status.ts",
            "src/order-status.test.ts",
            "src/order-status.test.helper.ts",
            "src/order-status.test-d.ts",
            "src/OrderStatus.stories.tsx",
            "src/Owner.stories.fixture.ts",
            "fixtures/order-status.ts",
            "src/order-status.d.ts",
            "src/contest.ts",
            "src/latest.ts",
          ]) {
            const absolutePath = pathService.join(repositoryRoot, relativePath);
            yield* filesystem.makeDirectory(pathService.dirname(absolutePath), { recursive: true });
            yield* filesystem.writeFileString(absolutePath, "export const total = 1;\n");
          }
          return listRepositoryFiles(repositoryRoot).declarationSources.map(
            (file) => file.relativePath,
          );
        },
      );
      const commentSourcePathsBesideNonProductionScripts = yield* Effect.gen(
        function* commentSourcePathsBesideNonProductionScripts() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          for (const relativePath of [
            "src/order-status.ts",
            "src/order-status.test.ts",
            "src/order-status.test.helper.ts",
            "src/order-status.test-d.ts",
            "src/OrderStatus.stories.tsx",
            "src/Owner.stories.fixture.ts",
            "fixtures/order-status.ts",
            "src/order-status.d.ts",
            "src/contest.ts",
            "src/latest.ts",
          ]) {
            const absolutePath = pathService.join(repositoryRoot, relativePath);
            yield* filesystem.makeDirectory(pathService.dirname(absolutePath), { recursive: true });
            yield* filesystem.writeFileString(absolutePath, "export const total = 1;\n");
          }
          return listRepositoryFiles(repositoryRoot).commentSources.map(
            (file) => file.relativePath,
          );
        },
      );
      return {
        declarationSourcePathsBesideNonProductionScripts,
        commentSourcePathsBesideNonProductionScripts,
      };
    });

    it.effect("let only the production TypeScript sources declare canonical values", () =>
      Effect.gen(function* program() {
        const { declarationSourcePathsBesideNonProductionScripts } = yield* fixtures;
        expect(declarationSourcePathsBesideNonProductionScripts).toStrictEqual([
          "src/contest.ts",
          "src/latest.ts",
          "src/order-status.ts",
        ]);
      }),
    );

    it.effect("are all listed as scripts whatever their role", () =>
      Effect.gen(function* program() {
        const { commentSourcePathsBesideNonProductionScripts } = yield* fixtures;
        expect(commentSourcePathsBesideNonProductionScripts).toStrictEqual([
          "fixtures/order-status.ts",
          "src/OrderStatus.stories.tsx",
          "src/Owner.stories.fixture.ts",
          "src/contest.ts",
          "src/latest.ts",
          "src/order-status.d.ts",
          "src/order-status.test-d.ts",
          "src/order-status.test.helper.ts",
          "src/order-status.test.ts",
          "src/order-status.ts",
        ]);
      }),
    );
  });

  describe("a repository holding lock files, manifests, JSON, and a readme", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const cacheInputPathsOfADependencyConfiguration = yield* Effect.gen(
        function* cacheInputPathsOfADependencyConfiguration() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          for (const relativePath of [
            ".npmrc",
            ".yarnrc.yml",
            "bun.lock",
            "bun.lockb",
            "deno.lock",
            "dist/generated.d.ts",
            "package.json",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
            "src/data.json",
            "src/runtime.ts",
            "src/types.d.ts",
            "tsconfig.json",
            "yarn.lock",
            "README.md",
          ]) {
            const absolutePath = pathService.join(repositoryRoot, relativePath);
            yield* filesystem.makeDirectory(pathService.dirname(absolutePath), { recursive: true });
            yield* filesystem.writeFileString(absolutePath, "{}\n");
          }
          return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
        },
      );
      const commentSourcePathsOfADependencyConfiguration = yield* Effect.gen(
        function* commentSourcePathsOfADependencyConfiguration() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          for (const relativePath of [
            ".npmrc",
            ".yarnrc.yml",
            "bun.lock",
            "bun.lockb",
            "deno.lock",
            "dist/generated.d.ts",
            "package.json",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
            "src/data.json",
            "src/runtime.ts",
            "src/types.d.ts",
            "tsconfig.json",
            "yarn.lock",
            "README.md",
          ]) {
            const absolutePath = pathService.join(repositoryRoot, relativePath);
            yield* filesystem.makeDirectory(pathService.dirname(absolutePath), { recursive: true });
            yield* filesystem.writeFileString(absolutePath, "{}\n");
          }
          return listRepositoryFiles(repositoryRoot).commentSources.map(
            (file) => file.relativePath,
          );
        },
      );
      const manifestPathsOfADependencyConfiguration = yield* Effect.gen(
        function* manifestPathsOfADependencyConfiguration() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          for (const relativePath of [
            ".npmrc",
            ".yarnrc.yml",
            "bun.lock",
            "bun.lockb",
            "deno.lock",
            "dist/generated.d.ts",
            "package.json",
            "pnpm-lock.yaml",
            "pnpm-workspace.yaml",
            "src/data.json",
            "src/runtime.ts",
            "src/types.d.ts",
            "tsconfig.json",
            "yarn.lock",
            "README.md",
          ]) {
            const absolutePath = pathService.join(repositoryRoot, relativePath);
            yield* filesystem.makeDirectory(pathService.dirname(absolutePath), { recursive: true });
            yield* filesystem.writeFileString(absolutePath, "{}\n");
          }
          return listRepositoryFiles(repositoryRoot).manifests.map((file) => file.relativePath);
        },
      );
      return {
        cacheInputPathsOfADependencyConfiguration,
        commentSourcePathsOfADependencyConfiguration,
        manifestPathsOfADependencyConfiguration,
      };
    });

    it.effect("cover the checker sources, declarations, JSON, and dependency configuration", () =>
      Effect.gen(function* program() {
        const { cacheInputPathsOfADependencyConfiguration } = yield* fixtures;
        expect(cacheInputPathsOfADependencyConfiguration).toStrictEqual([
          ".npmrc",
          ".yarnrc.yml",
          "bun.lock",
          "bun.lockb",
          "deno.lock",
          "dist/generated.d.ts",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
          "src/data.json",
          "src/runtime.ts",
          "src/types.d.ts",
          "tsconfig.json",
          "yarn.lock",
        ]);
      }),
    );

    it.effect("leave the readme and the generated declaration out of the scripts", () =>
      Effect.gen(function* program() {
        const { commentSourcePathsOfADependencyConfiguration } = yield* fixtures;
        expect(commentSourcePathsOfADependencyConfiguration).toStrictEqual([
          "src/runtime.ts",
          "src/types.d.ts",
        ]);
      }),
    );

    it.effect("hold the manifest apart from the rest", () =>
      Effect.gen(function* program() {
        const { manifestPathsOfADependencyConfiguration } = yield* fixtures;
        expect(manifestPathsOfADependencyConfiguration).toStrictEqual(["package.json"]);
      }),
    );
  });

  describe("a script reached through a link into a generated directory", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const commentSourcePathsOfALinkToGeneratedSource = yield* Effect.gen(
        function* commentSourcePathsOfALinkToGeneratedSource() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          const generatedSource = pathService.join(repositoryRoot, "dist/generated/consumer.ts");
          const linkPath = pathService.join(repositoryRoot, "src/consumer.ts");
          yield* filesystem.makeDirectory(pathService.dirname(generatedSource), {
            recursive: true,
          });
          yield* filesystem.makeDirectory(pathService.dirname(linkPath), { recursive: true });
          yield* filesystem.writeFileString(
            generatedSource,
            '// eslint-disable-next-line -- escape\nexport const status = "draft";\n',
          );
          yield* filesystem.symlink(generatedSource, linkPath);
          return listRepositoryFiles(repositoryRoot).commentSources.map(
            (file) => file.relativePath,
          );
        },
      );
      const declarationSourcePathsOfALinkToGeneratedSource = yield* Effect.gen(
        function* declarationSourcePathsOfALinkToGeneratedSource() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          const generatedSource = pathService.join(repositoryRoot, "dist/generated/consumer.ts");
          const linkPath = pathService.join(repositoryRoot, "src/consumer.ts");
          yield* filesystem.makeDirectory(pathService.dirname(generatedSource), {
            recursive: true,
          });
          yield* filesystem.makeDirectory(pathService.dirname(linkPath), { recursive: true });
          yield* filesystem.writeFileString(
            generatedSource,
            '// eslint-disable-next-line -- escape\nexport const status = "draft";\n',
          );
          yield* filesystem.symlink(generatedSource, linkPath);
          return listRepositoryFiles(repositoryRoot).declarationSources.map(
            (file) => file.relativePath,
          );
        },
      );
      const cacheInputPathsOfALinkToGeneratedSource = yield* Effect.gen(
        function* cacheInputPathsOfALinkToGeneratedSource() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          const generatedSource = pathService.join(repositoryRoot, "dist/generated/consumer.ts");
          const linkPath = pathService.join(repositoryRoot, "src/consumer.ts");
          yield* filesystem.makeDirectory(pathService.dirname(generatedSource), {
            recursive: true,
          });
          yield* filesystem.makeDirectory(pathService.dirname(linkPath), { recursive: true });
          yield* filesystem.writeFileString(
            generatedSource,
            '// eslint-disable-next-line -- escape\nexport const status = "draft";\n',
          );
          yield* filesystem.symlink(generatedSource, linkPath);
          return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
        },
      );
      const problemPathsOfALinkToGeneratedSource = yield* Effect.gen(
        function* problemPathsOfALinkToGeneratedSource() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          const generatedSource = pathService.join(repositoryRoot, "dist/generated/consumer.ts");
          const linkPath = pathService.join(repositoryRoot, "src/consumer.ts");
          yield* filesystem.makeDirectory(pathService.dirname(generatedSource), {
            recursive: true,
          });
          yield* filesystem.makeDirectory(pathService.dirname(linkPath), { recursive: true });
          yield* filesystem.writeFileString(
            generatedSource,
            '// eslint-disable-next-line -- escape\nexport const status = "draft";\n',
          );
          yield* filesystem.symlink(generatedSource, linkPath);
          return listRepositoryFiles(repositoryRoot).problems.map((problem) => problem.filePath);
        },
      );
      return {
        commentSourcePathsOfALinkToGeneratedSource,
        declarationSourcePathsOfALinkToGeneratedSource,
        cacheInputPathsOfALinkToGeneratedSource,
        problemPathsOfALinkToGeneratedSource,
      };
    });

    it.effect("is listed as a script under the path inside the sources", () =>
      Effect.gen(function* program() {
        const { commentSourcePathsOfALinkToGeneratedSource } = yield* fixtures;
        expect(commentSourcePathsOfALinkToGeneratedSource).toStrictEqual(["src/consumer.ts"]);
      }),
    );

    it.effect("cannot declare canonical values through the link", () =>
      Effect.gen(function* program() {
        const { declarationSourcePathsOfALinkToGeneratedSource } = yield* fixtures;
        expect(declarationSourcePathsOfALinkToGeneratedSource).toStrictEqual([]);
      }),
    );

    it.effect("keeps the cache identity of both paths", () =>
      Effect.gen(function* program() {
        const { cacheInputPathsOfALinkToGeneratedSource } = yield* fixtures;
        expect(cacheInputPathsOfALinkToGeneratedSource).toStrictEqual([
          "dist/generated/consumer.ts",
          "src/consumer.ts",
        ]);
      }),
    );

    it.effect("raises no problem", () =>
      Effect.gen(function* program() {
        const { problemPathsOfALinkToGeneratedSource } = yield* fixtures;
        expect(problemPathsOfALinkToGeneratedSource).toStrictEqual([]);
      }),
    );
  });

  describe("a script standing beside an alias of itself", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const commentSourcePathsOfAnAliasedScript = yield* Effect.gen(
        function* commentSourcePathsOfAnAliasedScript() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          const scriptPath = pathService.join(repositoryRoot, "src/status.ts");
          yield* filesystem.makeDirectory(pathService.dirname(scriptPath), { recursive: true });
          yield* filesystem.writeFileString(scriptPath, "export const status = 'draft';\n");
          yield* filesystem.symlink(
            "status.ts",
            pathService.join(repositoryRoot, "src/status-alias.ts"),
          );
          return listRepositoryFiles(repositoryRoot).commentSources.map(
            (file) => file.relativePath,
          );
        },
      );
      const cacheInputPathsOfAnAliasedScript = yield* Effect.gen(
        function* cacheInputPathsOfAnAliasedScript() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          const scriptPath = pathService.join(repositoryRoot, "src/status.ts");
          yield* filesystem.makeDirectory(pathService.dirname(scriptPath), { recursive: true });
          yield* filesystem.writeFileString(scriptPath, "export const status = 'draft';\n");
          yield* filesystem.symlink(
            "status.ts",
            pathService.join(repositoryRoot, "src/status-alias.ts"),
          );
          return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
        },
      );
      return { commentSourcePathsOfAnAliasedScript, cacheInputPathsOfAnAliasedScript };
    });

    it.effect("is scanned once under its physical path", () =>
      Effect.gen(function* program() {
        const { commentSourcePathsOfAnAliasedScript } = yield* fixtures;
        expect(commentSourcePathsOfAnAliasedScript).toStrictEqual(["src/status.ts"]);
      }),
    );

    it.effect("keeps both paths in the cache inputs", () =>
      Effect.gen(function* program() {
        const { cacheInputPathsOfAnAliasedScript } = yield* fixtures;
        expect(cacheInputPathsOfAnAliasedScript).toStrictEqual([
          "src/status-alias.ts",
          "src/status.ts",
        ]);
      }),
    );
  });

  describe("a directory reached through an alias inside the repository", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const cacheInputPathsOfAnAliasedDirectory = yield* Effect.gen(
        function* cacheInputPathsOfAnAliasedDirectory() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "shared"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            pathService.join(repositoryRoot, "shared/status.ts"),
            "export const status = 'draft';\n",
          );
          yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
            recursive: true,
          });
          yield* filesystem.symlink("../shared", pathService.join(repositoryRoot, "src/shared"));
          return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
        },
      );
      const commentSourcePathsOfAnAliasedDirectory = yield* Effect.gen(
        function* commentSourcePathsOfAnAliasedDirectory() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "shared"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            pathService.join(repositoryRoot, "shared/status.ts"),
            "export const status = 'draft';\n",
          );
          yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), {
            recursive: true,
          });
          yield* filesystem.symlink("../shared", pathService.join(repositoryRoot, "src/shared"));
          return listRepositoryFiles(repositoryRoot).commentSources.map(
            (file) => file.relativePath,
          );
        },
      );
      return { cacheInputPathsOfAnAliasedDirectory, commentSourcePathsOfAnAliasedDirectory };
    });

    it.effect("keeps both paths in the cache inputs", () =>
      Effect.gen(function* program() {
        const { cacheInputPathsOfAnAliasedDirectory } = yield* fixtures;
        expect(cacheInputPathsOfAnAliasedDirectory).toStrictEqual([
          "shared/status.ts",
          "src/shared/status.ts",
        ]);
      }),
    );

    it.effect("is scanned once under its physical path", () =>
      Effect.gen(function* program() {
        const { commentSourcePathsOfAnAliasedDirectory } = yield* fixtures;
        expect(commentSourcePathsOfAnAliasedDirectory).toStrictEqual(["shared/status.ts"]);
      }),
    );
  });

  describe("a link whose name belongs to no scanned kind", () => {
    const fixture = Effect.gen(function* repositoryFilesOfALinkWithAnUnscannedName() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "source-files-" });

      yield* filesystem.writeFileString(pathService.join(repositoryRoot, "README.md"), "status\n");
      yield* filesystem.symlink("README.md", pathService.join(repositoryRoot, "README-link.md"));
      return listRepositoryFiles(repositoryRoot);
    });

    it.effect("stays outside the source collections", () =>
      Effect.gen(function* program() {
        const repositoryFilesOfALinkWithAnUnscannedName = yield* fixture;
        expect(repositoryFilesOfALinkWithAnUnscannedName).toStrictEqual({
          cacheInputs: [],
          commentSources: [],
          declarationSources: [],
          manifests: [],
          markupSources: [],
          problems: [],
          styleSheets: [],
        });
      }),
    );
  });

  describe("links pointing outside the repository and at nothing", () => {
    const fixture = Effect.gen(function* repositoryFilesOfLinksLeavingTheRepository() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const enclosingDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-",
      });

      const repositoryRoot = pathService.join(enclosingDirectory, "repository");
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(enclosingDirectory, "external.ts"),
        'export const status = "draft";\n',
      );
      yield* filesystem.symlink(
        pathService.join(enclosingDirectory, "external.ts"),
        pathService.join(repositoryRoot, "src", "external.ts"),
      );
      yield* filesystem.symlink(
        pathService.join(enclosingDirectory, "missing.ts"),
        pathService.join(repositoryRoot, "src", "missing.ts"),
      );
      return listRepositoryFiles(repositoryRoot);
    });

    it.effect("become strict repository problems", () =>
      Effect.gen(function* program() {
        const repositoryFilesOfLinksLeavingTheRepository = yield* fixture;
        expect(repositoryFilesOfLinksLeavingTheRepository).toStrictEqual({
          cacheInputs: [],
          commentSources: [],
          declarationSources: [],
          manifests: [],
          markupSources: [],
          problems: [
            { kind: "unsafe-symbolic-link", line: 1, filePath: "src/external.ts" },
            { kind: "unsafe-symbolic-link", line: 1, filePath: "src/missing.ts" },
          ],
          styleSheets: [],
        });
      }),
    );
  });

  describe("a link that closes a cycle onto its own directory", () => {
    const fixture = Effect.gen(function* repositoryFilesOfALinkCycle() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "source-files-" });

      const sourceDirectory = pathService.join(repositoryRoot, "src");
      yield* filesystem.makeDirectory(sourceDirectory, { recursive: true });
      yield* filesystem.symlink(sourceDirectory, pathService.join(sourceDirectory, "cycle"));
      return listRepositoryFiles(repositoryRoot);
    });

    it.effect("becomes a strict repository problem", () =>
      Effect.gen(function* program() {
        const repositoryFilesOfALinkCycle = yield* fixture;
        expect(repositoryFilesOfALinkCycle).toStrictEqual({
          cacheInputs: [],
          commentSources: [],
          declarationSources: [],
          manifests: [],
          markupSources: [],
          problems: [{ kind: "unsafe-symbolic-link", line: 1, filePath: "src/cycle/cycle" }],
          styleSheets: [],
        });
      }),
    );
  });

  describe("a link to an agent-artifact directory outside the repository", () => {
    const fixture = Effect.gen(function* repositoryFilesBesideAnExternalArtifactLink() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const enclosingDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-",
      });

      const repositoryRoot = pathService.join(enclosingDirectory, "repository");
      yield* filesystem.makeDirectory(repositoryRoot, { recursive: true });
      const artifactDirectory = pathService.join(enclosingDirectory, "agent-artifacts");
      yield* filesystem.makeDirectory(artifactDirectory, { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(artifactDirectory, "notes.ts"),
        'export const status = "draft";\n',
      );
      yield* filesystem.symlink(
        artifactDirectory,
        pathService.join(repositoryRoot, ".local-agents"),
      );
      return listRepositoryFiles(repositoryRoot);
    });

    it.effect("stays outside the repository scan", () =>
      Effect.gen(function* program() {
        const repositoryFilesBesideAnExternalArtifactLink = yield* fixture;
        expect(repositoryFilesBesideAnExternalArtifactLink).toStrictEqual({
          cacheInputs: [],
          commentSources: [],
          declarationSources: [],
          manifests: [],
          markupSources: [],
          problems: [],
          styleSheets: [],
        });
      }),
    );
  });

  describe("an ignored source that git never tracked", () => {
    const fixture = Effect.gen(function* repositoryFilesOfAnUntrackedIgnoredSource() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "source-files-" });

      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "ignored"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, ".gitignore"),
        "ignored\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "ignored/status.ts"),
        'export const status = "draft";\n',
      );
      return listRepositoryFiles(repositoryRoot);
    });

    it.effect("enters no repository source collection", () =>
      Effect.gen(function* program() {
        const repositoryFilesOfAnUntrackedIgnoredSource = yield* fixture;
        expect(repositoryFilesOfAnUntrackedIgnoredSource).toStrictEqual({
          cacheInputs: [],
          commentSources: [],
          declarationSources: [],
          manifests: [],
          markupSources: [],
          problems: [],
          styleSheets: [],
        });
      }),
    );
  });

  describe("a directory git ignores as a whole", () => {
    const fixture = Effect.gen(function* pathsAskedAboutAnIgnoredDirectory() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "source-files-" });

      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "generated", "nested"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, ".gitignore"),
        "generated/\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "generated/nested/bundle.ts"),
        "export const bundle = 1;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "entry.ts"),
        "export const entry = 1;\n",
      );
      const gitScope = readGitSourceScope(repositoryRoot);
      const askedPaths: string[] = [];
      const repositoryFiles = listRepositoryFiles(repositoryRoot, {
        isIgnored(sourcePath) {
          askedPaths.push(pathService.relative(repositoryRoot, sourcePath));
          return gitScope.isIgnored(sourcePath);
        },
      });
      return { askedPaths, repositoryFiles };
    });

    it.effect("is not walked into", () =>
      Effect.gen(function* program() {
        const { askedPaths } = yield* fixture;
        expect(askedPaths.filter((askedPath) => askedPath.startsWith("generated/"))).toStrictEqual(
          [],
        );
      }),
    );

    it.effect("leaves the sources beside it listed", () =>
      Effect.gen(function* program() {
        const { repositoryFiles } = yield* fixture;
        expect(repositoryFiles.cacheInputs.map((file) => file.relativePath)).toStrictEqual([
          "entry.ts",
        ]);
      }),
    );
  });

  describe("a source the attributes file marks as generated", () => {
    const fixture = Effect.gen(function* repositoryFilesBesideAGeneratedSource() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "source-files-" });

      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src/app"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, ".gitattributes"),
        "**/routeTree.gen.ts linguist-generated\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/app/routeTree.gen.ts"),
        "/* eslint-disable */\nexport const routeTree = 1;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/app/router.ts"),
        "export const router = 1;\n",
      );
      const listed = listRepositoryFiles(repositoryRoot);
      return {
        cacheInputs: listed.cacheInputs.map((file) => file.relativePath),
        commentSources: listed.commentSources.map((file) => file.relativePath),
        declarationSources: listed.declarationSources.map((file) => file.relativePath),
      };
    });

    it.effect("stays a cache input but enters no source collection", () =>
      Effect.gen(function* program() {
        const repositoryFilesBesideAGeneratedSource = yield* fixture;
        expect(repositoryFilesBesideAGeneratedSource).toStrictEqual({
          cacheInputs: ["src/app/routeTree.gen.ts", "src/app/router.ts"],
          commentSources: ["src/app/router.ts"],
          declarationSources: ["src/app/router.ts"],
        });
      }),
    );
  });

  describe("a tracked source that a later ignore rule covers", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const cacheInputPathsOfATrackedIgnoredSource = yield* Effect.gen(
        function* cacheInputPathsOfATrackedIgnoredSource() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
          yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "ignored"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            pathService.join(repositoryRoot, "ignored/status.ts"),
            'export const status = "draft";\n',
          );
          gitOutput(["add", "ignored/status.ts"], { cwd: repositoryRoot, env: process.env });
          yield* filesystem.writeFileString(
            pathService.join(repositoryRoot, ".gitignore"),
            "ignored\n",
          );
          return listRepositoryFiles(repositoryRoot).cacheInputs.map((file) => file.relativePath);
        },
      );
      const commentSourcePathsOfATrackedIgnoredSource = yield* Effect.gen(
        function* commentSourcePathsOfATrackedIgnoredSource() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
          yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "ignored"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            pathService.join(repositoryRoot, "ignored/status.ts"),
            'export const status = "draft";\n',
          );
          gitOutput(["add", "ignored/status.ts"], { cwd: repositoryRoot, env: process.env });
          yield* filesystem.writeFileString(
            pathService.join(repositoryRoot, ".gitignore"),
            "ignored\n",
          );
          return listRepositoryFiles(repositoryRoot).commentSources.map(
            (file) => file.relativePath,
          );
        },
      );
      const declarationSourcePathsOfATrackedIgnoredSource = yield* Effect.gen(
        function* declarationSourcePathsOfATrackedIgnoredSource() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "source-files-",
          });

          gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
          yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "ignored"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            pathService.join(repositoryRoot, "ignored/status.ts"),
            'export const status = "draft";\n',
          );
          gitOutput(["add", "ignored/status.ts"], { cwd: repositoryRoot, env: process.env });
          yield* filesystem.writeFileString(
            pathService.join(repositoryRoot, ".gitignore"),
            "ignored\n",
          );
          return listRepositoryFiles(repositoryRoot).declarationSources.map(
            (file) => file.relativePath,
          );
        },
      );
      return {
        cacheInputPathsOfATrackedIgnoredSource,
        commentSourcePathsOfATrackedIgnoredSource,
        declarationSourcePathsOfATrackedIgnoredSource,
      };
    });

    it.effect("stays in the cache inputs", () =>
      Effect.gen(function* program() {
        const { cacheInputPathsOfATrackedIgnoredSource } = yield* fixtures;
        expect(cacheInputPathsOfATrackedIgnoredSource).toStrictEqual(["ignored/status.ts"]);
      }),
    );

    it.effect("stays among the scripts", () =>
      Effect.gen(function* program() {
        const { commentSourcePathsOfATrackedIgnoredSource } = yield* fixtures;
        expect(commentSourcePathsOfATrackedIgnoredSource).toStrictEqual(["ignored/status.ts"]);
      }),
    );

    it.effect("stays able to declare canonical values", () =>
      Effect.gen(function* program() {
        const { declarationSourcePathsOfATrackedIgnoredSource } = yield* fixtures;
        expect(declarationSourcePathsOfATrackedIgnoredSource).toStrictEqual(["ignored/status.ts"]);
      }),
    );
  });

  describe("an ignored link pointing outside the repository", () => {
    const fixture = Effect.gen(function* repositoryFilesOfAnIgnoredExternalLink() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const enclosingDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-",
      });

      const repositoryRoot = pathService.join(enclosingDirectory, "repository");
      yield* filesystem.makeDirectory(repositoryRoot, { recursive: true });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, ".gitignore"),
        "ignored.ts\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(enclosingDirectory, "external.ts"),
        'export const status = "draft";\n',
      );
      yield* filesystem.symlink(
        pathService.join(enclosingDirectory, "external.ts"),
        pathService.join(repositoryRoot, "ignored.ts"),
      );
      return listRepositoryFiles(repositoryRoot);
    });

    it.effect("is omitted before the unsafe-link check", () =>
      Effect.gen(function* program() {
        const repositoryFilesOfAnIgnoredExternalLink = yield* fixture;
        expect(repositoryFilesOfAnIgnoredExternalLink).toStrictEqual({
          cacheInputs: [],
          commentSources: [],
          declarationSources: [],
          manifests: [],
          markupSources: [],
          problems: [],
          styleSheets: [],
        });
      }),
    );
  });

  describe("a tracked link pointing outside the repository that a later ignore rule covers", () => {
    const fixture = Effect.gen(function* repositoryFilesOfATrackedIgnoredExternalLink() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const enclosingDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-",
      });

      const repositoryRoot = pathService.join(enclosingDirectory, "repository");
      yield* filesystem.makeDirectory(repositoryRoot, { recursive: true });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: process.env });
      yield* filesystem.writeFileString(
        pathService.join(enclosingDirectory, "external.ts"),
        'export const status = "draft";\n',
      );
      yield* filesystem.symlink(
        pathService.join(enclosingDirectory, "external.ts"),
        pathService.join(repositoryRoot, "ignored.ts"),
      );
      gitOutput(["add", "ignored.ts"], { cwd: repositoryRoot, env: process.env });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, ".gitignore"),
        "ignored.ts\n",
      );
      return listRepositoryFiles(repositoryRoot);
    });

    it.effect("remains an unsafe repository source", () =>
      Effect.gen(function* program() {
        const repositoryFilesOfATrackedIgnoredExternalLink = yield* fixture;
        expect(repositoryFilesOfATrackedIgnoredExternalLink).toStrictEqual({
          cacheInputs: [],
          commentSources: [],
          declarationSources: [],
          manifests: [],
          markupSources: [],
          problems: [{ kind: "unsafe-symbolic-link", line: 1, filePath: "ignored.ts" }],
          styleSheets: [],
        });
      }),
    );
  });
});

layer(NodeServices.layer)("nearestPackageDirectory", (it) => {
  describe("a directory that holds a manifest", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const ownManifestRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-own-manifest-",
      });
      const packageDirectoryOfADirectoryHoldingAManifest = yield* Effect.gen(
        function* packageDirectoryOfADirectoryHoldingAManifest() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(pathService.join(ownManifestRoot, "packages", "order"), {
            recursive: true,
          });

          yield* filesystem.writeFileString(
            pathService.join(ownManifestRoot, "packages", "order", "package.json"),
            "{}",
          );
          return nearestPackageDirectory(
            pathService.join(ownManifestRoot, "packages", "order"),
            ownManifestRoot,
          );
        },
      );
      return { ownManifestRoot, packageDirectoryOfADirectoryHoldingAManifest };
    });

    it.effect("is its own package", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { packageDirectoryOfADirectoryHoldingAManifest, ownManifestRoot } = yield* fixtures;
        expect(packageDirectoryOfADirectoryHoldingAManifest).toBe(
          pathService.join(ownManifestRoot, "packages", "order"),
        );
      }),
    );
  });

  describe("a directory below a manifest", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const manifestAboveRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-manifest-above-",
      });
      const packageDirectoryOfADirectoryBelowAManifest = yield* Effect.gen(
        function* packageDirectoryOfADirectoryBelowAManifest() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(
            pathService.join(manifestAboveRoot, "packages", "order", "src", "lint"),
            { recursive: true },
          );

          yield* filesystem.writeFileString(
            pathService.join(manifestAboveRoot, "packages", "order", "package.json"),
            "{}",
          );
          return nearestPackageDirectory(
            pathService.join(manifestAboveRoot, "packages", "order", "src", "lint"),
            manifestAboveRoot,
          );
        },
      );
      return { manifestAboveRoot, packageDirectoryOfADirectoryBelowAManifest };
    });

    it.effect("belongs to the package that holds it", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { packageDirectoryOfADirectoryBelowAManifest, manifestAboveRoot } = yield* fixtures;
        expect(packageDirectoryOfADirectoryBelowAManifest).toBe(
          pathService.join(manifestAboveRoot, "packages", "order"),
        );
      }),
    );
  });

  describe("a directory standing between two manifests", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const rivalManifestsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-rival-manifests-",
      });
      const packageDirectoryBetweenTwoManifests = yield* Effect.gen(
        function* packageDirectoryBetweenTwoManifests() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(
            pathService.join(rivalManifestsRoot, "packages", "order", "src"),
            { recursive: true },
          );

          yield* filesystem.writeFileString(
            pathService.join(rivalManifestsRoot, "package.json"),
            "{}",
          );
          yield* filesystem.writeFileString(
            pathService.join(rivalManifestsRoot, "packages", "order", "package.json"),
            "{}",
          );
          return nearestPackageDirectory(
            pathService.join(rivalManifestsRoot, "packages", "order", "src"),
            rivalManifestsRoot,
          );
        },
      );
      return { rivalManifestsRoot, packageDirectoryBetweenTwoManifests };
    });

    it.effect("belongs to the nearer manifest rather than the one further up", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { packageDirectoryBetweenTwoManifests, rivalManifestsRoot } = yield* fixtures;
        expect(packageDirectoryBetweenTwoManifests).toBe(
          pathService.join(rivalManifestsRoot, "packages", "order"),
        );
      }),
    );
  });

  describe("a directory under a repository whose root holds the only manifest", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const rootOnlyManifestRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-root-only-manifest-",
      });
      const packageDirectoryUnderARootHoldingTheOnlyManifest = yield* Effect.gen(
        function* packageDirectoryUnderARootHoldingTheOnlyManifest() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(pathService.join(rootOnlyManifestRoot, "scripts"), {
            recursive: true,
          });

          yield* filesystem.writeFileString(
            pathService.join(rootOnlyManifestRoot, "package.json"),
            "{}",
          );
          return nearestPackageDirectory(
            pathService.join(rootOnlyManifestRoot, "scripts"),
            rootOnlyManifestRoot,
          );
        },
      );
      return { rootOnlyManifestRoot, packageDirectoryUnderARootHoldingTheOnlyManifest };
    });

    it.effect("belongs to the root", () =>
      Effect.gen(function* program() {
        const { packageDirectoryUnderARootHoldingTheOnlyManifest, rootOnlyManifestRoot } =
          yield* fixtures;
        expect(packageDirectoryUnderARootHoldingTheOnlyManifest).toBe(rootOnlyManifestRoot);
      }),
    );
  });

  describe("a directory under a repository whose root holds no manifest", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const noManifestRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "source-files-no-manifest-",
      });
      const packageDirectoryUnderARootHoldingNoManifest = yield* Effect.gen(
        function* packageDirectoryUnderARootHoldingNoManifest() {
          const filesystem = yield* FileSystem.FileSystem;
          const pathService = yield* Path.Path;

          yield* filesystem.makeDirectory(pathService.join(noManifestRoot, "scripts"), {
            recursive: true,
          });

          return nearestPackageDirectory(
            pathService.join(noManifestRoot, "scripts"),
            noManifestRoot,
          );
        },
      );
      return { noManifestRoot, packageDirectoryUnderARootHoldingNoManifest };
    });

    it.effect("is left in no package", () =>
      Effect.gen(function* program() {
        const { packageDirectoryUnderARootHoldingNoManifest } = yield* fixtures;
        expect(packageDirectoryUnderARootHoldingNoManifest).toBe(null);
      }),
    );
  });

  describe("a directory standing above the repository root", () => {
    const fixture = Effect.gen(function* packageDirectoryOutsideTheRepository() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "source-files-" });

      return nearestPackageDirectory(pathService.dirname(repositoryRoot), repositoryRoot);
    });

    it.effect("cannot acquire a package", () =>
      Effect.gen(function* program() {
        const packageDirectoryOutsideTheRepository = yield* fixture;
        expect(packageDirectoryOutsideTheRepository).toBe(null);
      }),
    );
  });
});
