import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { isEqual } from "es-toolkit";
import { describe, expect } from "vite-plus/test";

import { pathExists } from "../../../../platform/file-system.ts";
import { analyzeCanonicalValuesRepository, loadCanonicalValuesCatalogSnapshot } from "./builder.ts";

const TAG = "@canonical-values";

const ORDER_STATUS_ARRAY = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`;

const ORDER_STATUS_DRAFT_ONLY = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const ORDER_STATUS_FINAL_ONLY = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["final"] as const;\n`;

const ORDER_STATUS_AMBIENT = `/** ${TAG} order.status */\nexport declare const ORDER_STATUSES: readonly ["draft", "published"];\n`;

const STORY_STATUS_DRAFT_ONLY = `/** ${TAG} story.status */\nexport const STATUSES = ["draft"] as const;\n`;

const TEST_STATUS_TESTED_ONLY = `/** ${TAG} test.status */\nexport const TEST_STATUSES = ["tested"] as const;\n`;

const TYPE_TEST_STATUS_TYPED_ONLY = `/** ${TAG} type-test.status */\nexport const TYPE_TEST_STATUSES = ["typed"] as const;\n`;

const FIXTURE_STATUS_PUBLISHED_ONLY = `/** ${TAG} fixture.status */\nexport const STATUSES = ["published"] as const;\n`;

const ORDER_STATUS_DRAFT_UNDER_A = `/** ${TAG} order.status */\nexport const A = ["draft"] as const;\n`;

const ORDER_STATUS_PUBLISHED_UNDER_B = `/** ${TAG} order.status */\nexport const B = ["published"] as const;\n`;

const REEXPORTED_ORDER_STATUSES = 'export { ORDER_STATUSES } from "./order-status.ts";\n';

const ALIASED_ORDER_STATUSES =
  'export { ORDER_STATUSES as PUBLIC_STATUSES } from "./order-status.ts";\n';

const SHADOW_STATUSES = 'export const SHADOW_STATUSES = ["draft", "published"] as const;\n';

const GENERATED_ORDER_STATUSES = 'export const ORDER_STATUSES = ["shadow"] as const;\n';

const EXTERNAL_DRAFT = 'export const EXTERNAL = "draft";\n';

layer(NodeServices.layer)("analyzeCanonicalValuesRepository", (it) => {
  describe("a declaration two entries of the export map reach", () => {
    const fixture = Effect.gen(function* importRoutesOfADeclarationTwoExportsReach() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages", "vocabulary", "src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "vocabulary", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/vocabulary",
          exports: {
            ".": "./src/index.ts",
            "./alias": "./src/alias.ts",
            "./shadow": "./src/shadow.ts",
          },
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "vocabulary", "src", "order-status.ts"),
        ORDER_STATUS_ARRAY,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "vocabulary", "src", "index.ts"),
        REEXPORTED_ORDER_STATUSES,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "vocabulary", "src", "alias.ts"),
        ALIASED_ORDER_STATUSES,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "vocabulary", "src", "shadow.ts"),
        SHADOW_STATUSES,
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
        (catalogedConcept) => catalogedConcept.importRoutes,
      );
    });

    it.effect("keep the exact symbol each one exports", () =>
      Effect.gen(function* program() {
        const importRoutesOfADeclarationTwoExportsReach = yield* fixture;
        expect(importRoutesOfADeclarationTwoExportsReach).toStrictEqual([
          [
            {
              exportName: "ORDER_STATUSES",
              resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
              specifier: "@fixture/vocabulary",
            },
            {
              exportName: "PUBLIC_STATUSES",
              resolvedSourcePaths: ["packages/vocabulary/src/alias.ts"],
              specifier: "@fixture/vocabulary/alias",
            },
          ],
        ]);
      }),
    );
  });

  describe("a declaration no entry of the export map reaches", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const importRoutesOfADeclarationNoExportReaches = yield* Effect.gen(
        function* importRoutesOfADeclarationNoExportReaches() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "packages", "vocabulary", "src"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "@fixture/vocabulary",
              exports: { ".": "./src/index.ts" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "src", "index.ts"),
            SHADOW_STATUSES,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "src", "order-status.ts"),
            ORDER_STATUS_ARRAY,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
            (catalogedConcept) => catalogedConcept.importRoutes,
          );
        },
      );
      const packageNamesOfADeclarationNoExportReaches = yield* Effect.gen(
        function* packageNamesOfADeclarationNoExportReaches() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "packages", "vocabulary", "src"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "@fixture/vocabulary",
              exports: { ".": "./src/index.ts" },
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "src", "index.ts"),
            SHADOW_STATUSES,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "src", "order-status.ts"),
            ORDER_STATUS_ARRAY,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
            (catalogedConcept) => catalogedConcept.packageName,
          );
        },
      );
      return {
        importRoutesOfADeclarationNoExportReaches,
        packageNamesOfADeclarationNoExportReaches,
      };
    });

    it.effect("is reached by no route at all", () =>
      Effect.gen(function* program() {
        const { importRoutesOfADeclarationNoExportReaches } = yield* fixtures;
        expect(importRoutesOfADeclarationNoExportReaches).toStrictEqual([[]]);
      }),
    );

    it.effect("keeps the identity of the package that owns it", () =>
      Effect.gen(function* program() {
        const { packageNamesOfADeclarationNoExportReaches } = yield* fixtures;
        expect(packageNamesOfADeclarationNoExportReaches).toStrictEqual(["@fixture/vocabulary"]);
      }),
    );
  });

  describe("an export map that points at generated JavaScript", () => {
    const fixture = Effect.gen(function* importRoutesOfAJavaScriptExportTarget() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages", "vocabulary", "src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "vocabulary", "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          name: "@fixture/vocabulary",
          exports: { ".": "./src/index.js" },
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "vocabulary", "src", "index.js"),
        GENERATED_ORDER_STATUSES,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "vocabulary", "src", "index.ts"),
        REEXPORTED_ORDER_STATUSES,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "vocabulary", "src", "order-status.ts"),
        ORDER_STATUS_ARRAY,
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
        (catalogedConcept) => catalogedConcept.importRoutes,
      );
    });

    it.effect("resolves to the TypeScript source behind it", () =>
      Effect.gen(function* program() {
        const importRoutesOfAJavaScriptExportTarget = yield* fixture;
        expect(importRoutesOfAJavaScriptExportTarget).toStrictEqual([
          [
            {
              exportName: "ORDER_STATUSES",
              resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
              specifier: "@fixture/vocabulary",
            },
          ],
        ]);
      }),
    );
  });

  describe("a package manifest that is not json", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPathsOfAManifestThatIsNotJson = yield* Effect.gen(
        function* declarationPathsOfAManifestThatIsNotJson() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "packages", "vocabulary", "src"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "package.json"),
            "{not json\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "src", "order-status.ts"),
            ORDER_STATUS_ARRAY,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
            (catalogedConcept) => catalogedConcept.declarationPath,
          );
        },
      );
      const vocabularyProblemsOfAManifestThatIsNotJson = yield* Effect.gen(
        function* vocabularyProblemsOfAManifestThatIsNotJson() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "packages", "vocabulary", "src"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "package.json"),
            "{not json\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "packages", "vocabulary", "src", "order-status.ts"),
            ORDER_STATUS_ARRAY,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).problems.filter(
            (reported) => reported.kind === "vocabulary-without-values",
          );
        },
      );
      return {
        declarationPathsOfAManifestThatIsNotJson,
        vocabularyProblemsOfAManifestThatIsNotJson,
      };
    });

    it.effect("catalogs nothing behind the surface it could not read", () =>
      Effect.gen(function* program() {
        const { declarationPathsOfAManifestThatIsNotJson } = yield* fixtures;
        expect(declarationPathsOfAManifestThatIsNotJson).toStrictEqual([]);
      }),
    );

    it.effect("reports the vocabulary it could not carry instead of crashing", () =>
      Effect.gen(function* program() {
        const { vocabularyProblemsOfAManifestThatIsNotJson } = yield* fixtures;
        expect(vocabularyProblemsOfAManifestThatIsNotJson).toStrictEqual([
          {
            kind: "vocabulary-without-values",
            filePath: "packages/vocabulary/src/order-status.ts",
            line: 1,
            conceptId: "order.status",
          },
        ]);
      }),
    );
  });

  describe("annotations written outside the sources the catalog owns", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPathsOfOutOfScopeAnnotations = yield* Effect.gen(
        function* declarationPathsOfOutOfScopeAnnotations() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.makeDirectory(paths.join(root, "fixtures"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "Owner.stories.fixture.ts"),
            STORY_STATUS_DRAFT_ONLY,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order.test.helper.ts"),
            TEST_STATUS_TESTED_ONLY,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order.test-d.ts"),
            TYPE_TEST_STATUS_TYPED_ONLY,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "fixtures", "order.ts"),
            FIXTURE_STATUS_PUBLISHED_ONLY,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
            (catalogedConcept) => catalogedConcept.declarationPath,
          );
        },
      );
      const problemKindsAndPathsOfOutOfScopeAnnotations = yield* Effect.gen(
        function* problemKindsAndPathsOfOutOfScopeAnnotations() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.makeDirectory(paths.join(root, "fixtures"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "Owner.stories.fixture.ts"),
            STORY_STATUS_DRAFT_ONLY,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order.test.helper.ts"),
            TEST_STATUS_TESTED_ONLY,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order.test-d.ts"),
            TYPE_TEST_STATUS_TYPED_ONLY,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "fixtures", "order.ts"),
            FIXTURE_STATUS_PUBLISHED_ONLY,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).problems.map(
            (reported) => [reported.kind, reported.filePath],
          );
        },
      );
      return {
        declarationPathsOfOutOfScopeAnnotations,
        problemKindsAndPathsOfOutOfScopeAnnotations,
      };
    });

    it.effect("own no concept", () =>
      Effect.gen(function* program() {
        const { declarationPathsOfOutOfScopeAnnotations } = yield* fixtures;
        expect(declarationPathsOfOutOfScopeAnnotations).toStrictEqual([]);
      }),
    );

    it.effect("are reported where they are written", () =>
      Effect.gen(function* program() {
        const { problemKindsAndPathsOfOutOfScopeAnnotations } = yield* fixtures;
        expect(problemKindsAndPathsOfOutOfScopeAnnotations).toStrictEqual([
          ["out-of-scope-declaration", "fixtures/order.ts"],
          ["out-of-scope-declaration", "src/Owner.stories.fixture.ts"],
          ["out-of-scope-declaration", "src/order.test-d.ts"],
          ["out-of-scope-declaration", "src/order.test.helper.ts"],
        ]);
      }),
    );
  });

  describe("an ambient declaration written in a source and in a declaration file", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPathsOfAnAmbientDeclaration = yield* Effect.gen(
        function* declarationPathsOfAnAmbientDeclaration() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.d.ts"),
            ORDER_STATUS_AMBIENT,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_AMBIENT,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
            (catalogedConcept) => catalogedConcept.declarationPath,
          );
        },
      );
      const problemKindsAndPathsOfAnAmbientDeclaration = yield* Effect.gen(
        function* problemKindsAndPathsOfAnAmbientDeclaration() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.d.ts"),
            ORDER_STATUS_AMBIENT,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_AMBIENT,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).problems.map(
            (reported) => [reported.kind, reported.filePath],
          );
        },
      );
      return { declarationPathsOfAnAmbientDeclaration, problemKindsAndPathsOfAnAmbientDeclaration };
    });

    it.effect("becomes no runtime owner", () =>
      Effect.gen(function* program() {
        const { declarationPathsOfAnAmbientDeclaration } = yield* fixtures;
        expect(declarationPathsOfAnAmbientDeclaration).toStrictEqual([]);
      }),
    );

    it.effect("is reported in both files", () =>
      Effect.gen(function* program() {
        const { problemKindsAndPathsOfAnAmbientDeclaration } = yield* fixtures;
        expect(problemKindsAndPathsOfAnAmbientDeclaration).toStrictEqual([
          ["invalid-declaration", "src/order-status.d.ts"],
          ["invalid-declaration", "src/order-status.ts"],
        ]);
      }),
    );
  });

  describe("two declarations of one concept", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPathsOfADuplicatedConcept = yield* Effect.gen(
        function* declarationPathsOfADuplicatedConcept() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "@fixture/repository",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "a.ts"),
            ORDER_STATUS_DRAFT_UNDER_A,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "b.ts"),
            ORDER_STATUS_PUBLISHED_UNDER_B,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
            (catalogedConcept) => catalogedConcept.declarationPath,
          );
        },
      );
      const packageNamesOfADuplicatedConcept = yield* Effect.gen(
        function* packageNamesOfADuplicatedConcept() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              name: "@fixture/repository",
            }),
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "a.ts"),
            ORDER_STATUS_DRAFT_UNDER_A,
          );
          yield* filesystem.writeFileString(
            paths.join(root, "src", "b.ts"),
            ORDER_STATUS_PUBLISHED_UNDER_B,
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root })
            .catalog.packageNames.values()
            .toArray();
        },
      );
      return { declarationPathsOfADuplicatedConcept, packageNamesOfADuplicatedConcept };
    });

    it.effect("are excluded from the catalog together", () =>
      Effect.gen(function* program() {
        const { declarationPathsOfADuplicatedConcept } = yield* fixtures;
        expect(declarationPathsOfADuplicatedConcept).toStrictEqual([]);
      }),
    );

    it.effect("still leave the catalog naming the package that holds them", () =>
      Effect.gen(function* program() {
        const { packageNamesOfADuplicatedConcept } = yield* fixtures;
        expect(packageNamesOfADuplicatedConcept).toStrictEqual(["@fixture/repository"]);
      }),
    );
  });

  describe("a symbolic link that leaves the repository", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const unsafeLinkProblemsOfALinkLeavingTheRepository = yield* Effect.gen(
        function* unsafeLinkProblemsOfALinkLeavingTheRepository() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });
          const externalRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "canonical-values-",
          });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_ARRAY,
          );
          yield* filesystem.writeFileString(
            paths.join(externalRoot, "external.ts"),
            EXTERNAL_DRAFT,
          );
          yield* filesystem.symlink(
            paths.join(externalRoot, "external.ts"),
            paths.join(root, "src", "external.ts"),
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).problems.filter(
            (reported) => reported.kind === "unsafe-symbolic-link",
          );
        },
      );
      const declarationPathsOfALinkLeavingTheRepository = yield* Effect.gen(
        function* declarationPathsOfALinkLeavingTheRepository() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });
          const externalRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "canonical-values-",
          });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_ARRAY,
          );
          yield* filesystem.writeFileString(
            paths.join(externalRoot, "external.ts"),
            EXTERNAL_DRAFT,
          );
          yield* filesystem.symlink(
            paths.join(externalRoot, "external.ts"),
            paths.join(root, "src", "external.ts"),
          );
          return analyzeCanonicalValuesRepository({ repositoryRoot: root }).catalog.entries.map(
            (catalogedConcept) => catalogedConcept.declarationPath,
          );
        },
      );
      return {
        unsafeLinkProblemsOfALinkLeavingTheRepository,
        declarationPathsOfALinkLeavingTheRepository,
      };
    });

    it.effect("is reported where it is followed", () =>
      Effect.gen(function* program() {
        const { unsafeLinkProblemsOfALinkLeavingTheRepository } = yield* fixtures;
        expect(unsafeLinkProblemsOfALinkLeavingTheRepository).toStrictEqual([
          { kind: "unsafe-symbolic-link", filePath: "src/external.ts", line: 1 },
        ]);
      }),
    );

    it.effect("prevents every entry the checkout would have carried", () =>
      Effect.gen(function* program() {
        const { declarationPathsOfALinkLeavingTheRepository } = yield* fixtures;
        expect(declarationPathsOfALinkLeavingTheRepository).toStrictEqual([]);
      }),
    );
  });
});

layer(NodeServices.layer)("loadCanonicalValuesCatalogSnapshot", (it) => {
  describe("a repository rewritten after its first snapshot", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const theSnapshotReadAgainIsTheFirstSnapshot = yield* Effect.gen(
        function* theSnapshotReadAgainIsTheFirstSnapshot() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_DRAFT_ONLY,
          );
          const firstSnapshot = loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_FINAL_ONLY,
          );
          return loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root }) === firstSnapshot;
        },
      );
      const canonicalValuesOfTheSnapshotReadAgain = yield* Effect.gen(
        function* canonicalValuesOfTheSnapshotReadAgain() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_DRAFT_ONLY,
          );
          loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_FINAL_ONLY,
          );
          return loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root }).entries.map(
            (catalogedConcept) => catalogedConcept.values,
          );
        },
      );
      return { theSnapshotReadAgainIsTheFirstSnapshot, canonicalValuesOfTheSnapshotReadAgain };
    });

    it.effect("hands back the object the first read handed back", () =>
      Effect.gen(function* program() {
        const { theSnapshotReadAgainIsTheFirstSnapshot } = yield* fixtures;
        expect(theSnapshotReadAgainIsTheFirstSnapshot).toBe(true);
      }),
    );

    it.effect("carries what the repository said before it was rewritten", () =>
      Effect.gen(function* program() {
        const { canonicalValuesOfTheSnapshotReadAgain } = yield* fixtures;
        expect(canonicalValuesOfTheSnapshotReadAgain).toStrictEqual([["draft"]]);
      }),
    );
  });

  describe("a second lexical root for one repository", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const theSnapshotOfASecondLexicalRootIsTheFirstSnapshot = yield* Effect.gen(
        function* theSnapshotOfASecondLexicalRootIsTheFirstSnapshot() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });
          const linkRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "canonical-values-",
          });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_DRAFT_ONLY,
          );
          const firstSnapshot = loadCanonicalValuesCatalogSnapshot({ repositoryRoot: root });
          yield* filesystem.symlink(root, paths.join(linkRoot, "repository"));
          return (
            loadCanonicalValuesCatalogSnapshot({
              repositoryRoot: paths.join(linkRoot, "repository"),
            }) === firstSnapshot
          );
        },
      );
      const theSnapshotOfASecondLexicalRootCarriesTheEntriesOfTheFirst = yield* Effect.gen(
        function* theSnapshotOfASecondLexicalRootCarriesTheEntriesOfTheFirst() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });
          const linkRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "canonical-values-",
          });

          yield* filesystem.makeDirectory(paths.join(root, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "src", "order-status.ts"),
            ORDER_STATUS_DRAFT_ONLY,
          );
          const firstEntries = loadCanonicalValuesCatalogSnapshot({
            repositoryRoot: root,
          }).entries;
          yield* filesystem.symlink(root, paths.join(linkRoot, "repository"));
          return isEqual(
            loadCanonicalValuesCatalogSnapshot({
              repositoryRoot: paths.join(linkRoot, "repository"),
            }).entries,
            firstEntries,
          );
        },
      );
      return {
        theSnapshotOfASecondLexicalRootIsTheFirstSnapshot,
        theSnapshotOfASecondLexicalRootCarriesTheEntriesOfTheFirst,
      };
    });

    it.effect("is a snapshot of its own", () =>
      Effect.gen(function* program() {
        const { theSnapshotOfASecondLexicalRootIsTheFirstSnapshot } = yield* fixtures;
        expect(theSnapshotOfASecondLexicalRootIsTheFirstSnapshot).toBe(false);
      }),
    );

    it.effect("is read back from the cache the first root wrote", () =>
      Effect.gen(function* program() {
        const { theSnapshotOfASecondLexicalRootCarriesTheEntriesOfTheFirst } = yield* fixtures;
        expect(theSnapshotOfASecondLexicalRootCarriesTheEntriesOfTheFirst).toBe(true);
      }),
    );
  });

  describe("a repository root that is not on disk", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPathsOfARepositoryRootThatIsNotOnDisk = yield* Effect.gen(
        function* declarationPathsOfARepositoryRootThatIsNotOnDisk() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          return loadCanonicalValuesCatalogSnapshot({
            repositoryRoot: paths.join(root, "missing"),
          }).entries.map((catalogedConcept) => catalogedConcept.declarationPath);
        },
      );
      const aRepositoryRootThatIsNotOnDiskExistsAfterTheRead = yield* Effect.gen(
        function* aRepositoryRootThatIsNotOnDiskExistsAfterTheRead() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

          loadCanonicalValuesCatalogSnapshot({ repositoryRoot: paths.join(root, "missing") });
          return yield* pathExists(paths.join(root, "missing"));
        },
      );
      return {
        declarationPathsOfARepositoryRootThatIsNotOnDisk,
        aRepositoryRootThatIsNotOnDiskExistsAfterTheRead,
      };
    });

    it.effect("yields an empty catalog", () =>
      Effect.gen(function* program() {
        const { declarationPathsOfARepositoryRootThatIsNotOnDisk } = yield* fixtures;
        expect(declarationPathsOfARepositoryRootThatIsNotOnDisk).toStrictEqual([]);
      }),
    );

    it.effect("is left uncreated", () =>
      Effect.gen(function* program() {
        const { aRepositoryRootThatIsNotOnDiskExistsAfterTheRead } = yield* fixtures;
        expect(aRepositoryRootThatIsNotOnDiskExistsAfterTheRead).toBe(false);
      }),
    );
  });
});
