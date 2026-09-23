import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import { buildCatalog } from "./catalog.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { importRouteStatus } from "./import-route.ts";

layer(NodeServices.layer)("importRouteStatus", (it) => {
  describe("a binding the public specifier does not export", () => {
    const it = test.extend("statusOfAShadowBindingOnThePublicSpecifier", () =>
      importRouteStatus(
        {
          importedName: "SHADOW_STATUSES",
          specifier: "@mst/order-vocabulary",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfAShadowBindingOnThePublicSpecifier }) => {
      expect(statusOfAShadowBindingOnThePublicSpecifier).toBe("unregistered");
    });
  });

  describe("a subpath of a package whose owner publishes another route", () => {
    const it = test.extend("statusOfAnUnregisteredSubpathOfAnOwnedPackage", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@mst/order-vocabulary/shadow",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfAnUnregisteredSubpathOfAnOwnedPackage }) => {
      expect(statusOfAnUnregisteredSubpathOfAnOwnedPackage).toBe("unregistered");
    });
  });

  describe("a shadow export of a package that publishes no route at all", () => {
    const it = test.extend("statusOfAShadowExportOfAPackageWithoutPublicRoutes", () =>
      importRouteStatus(
        {
          importedName: "SHADOW_STATUSES",
          specifier: "@mst/order-vocabulary/shadow",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is still rejected", ({ statusOfAShadowExportOfAPackageWithoutPublicRoutes }) => {
      expect(statusOfAShadowExportOfAPackageWithoutPublicRoutes).toBe("unregistered");
    });
  });

  describe("a repository package the catalog holds no owner declaration for", () => {
    const it = test.extend("statusOfAPackageWithoutAnOwnerDeclaration", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@mst/order-vocabulary",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([], { packageNames: ["@mst/order-vocabulary"] }),
      ));

    it("remains unregistered", ({ statusOfAPackageWithoutAnOwnerDeclaration }) => {
      expect(statusOfAPackageWithoutAnOwnerDeclaration).toBe("unregistered");
    });
  });

  describe("a specifier that only starts with the same letters as the export path", () => {
    const it = test.extend("statusOfASpecifierSharingTheOpeningLetters", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@mst/order-vocabulary-legacy",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is external rather than registered", ({ statusOfASpecifierSharingTheOpeningLetters }) => {
      expect(statusOfASpecifierSharingTheOpeningLetters).toBe("external");
    });
  });

  describe("a specifier naming a runtime built-in module", () => {
    const it = test.extend("statusOfABuiltinProtocolSpecifier", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "node:fs",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is external", ({ statusOfABuiltinProtocolSpecifier }) => {
      expect(statusOfABuiltinProtocolSpecifier).toBe("external");
    });
  });

  describe("a relative route into a module the source scope ignores", () => {
    const fixture = Effect.gen(function* statusOfARouteIntoAnIgnoredModule() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-ignored-",
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
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./order-status.ts",
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog(
          [
            {
              annotationStart: 0,
              binding: "ORDER_STATUSES",
              bindingStart: 40,
              conceptId: "order.status",
              declarationEnd: 80,
              declarationPath: "src/order-status.ts",
              declarationStart: 20,
              importRoutes: [],
              packageName: "@mst/order-vocabulary",
              values: ["draft", "published"],
              fingerprint: fingerprintValues(["draft", "published"]),
            },
          ],
          { sourceScope: { isIgnored: () => true } },
        ),
      );
    });

    it.effect("carries no registered entry", () =>
      Effect.gen(function* program() {
        const statusOfARouteIntoAnIgnoredModule = yield* fixture;
        expect(statusOfARouteIntoAnIgnoredModule).toBe("external");
      }),
    );
  });

  describe("a relative owner route written with the ts extension", () => {
    const fixture = Effect.gen(function* statusOfARelativeOwnerRouteWithTheTsExtension() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-relative-ts-",
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
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./order-status.ts",
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("is registered", () =>
      Effect.gen(function* program() {
        const statusOfARelativeOwnerRouteWithTheTsExtension = yield* fixture;
        expect(statusOfARelativeOwnerRouteWithTheTsExtension).toBe("registered");
      }),
    );
  });

  describe("a relative owner route written without an extension", () => {
    const fixture = Effect.gen(function* statusOfARelativeOwnerRouteWithoutAnExtension() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-relative-bare-",
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
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./order-status",
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("resolves the same way and is registered", () =>
      Effect.gen(function* program() {
        const statusOfARelativeOwnerRouteWithoutAnExtension = yield* fixture;
        expect(statusOfARelativeOwnerRouteWithoutAnExtension).toBe("registered");
      }),
    );
  });

  describe("a relative owner route written with the js extension", () => {
    const fixture = Effect.gen(function* statusOfARelativeOwnerRouteWithTheJsExtension() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-relative-js-",
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
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./order-status.js",
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("resolves to the ts declaration and is registered", () =>
      Effect.gen(function* program() {
        const statusOfARelativeOwnerRouteWithTheJsExtension = yield* fixture;
        expect(statusOfARelativeOwnerRouteWithTheJsExtension).toBe("registered");
      }),
    );
  });

  describe("a binding the relative declaration route does not own", () => {
    const fixture = Effect.gen(function* statusOfANonOwnerBindingOnARelativeDeclarationRoute() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-relative-binding-",
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
      return importRouteStatus(
        {
          importedName: "PUBLIC_STATUSES",
          specifier: "./order-status.ts",
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("is unregistered", () =>
      Effect.gen(function* program() {
        const statusOfANonOwnerBindingOnARelativeDeclarationRoute = yield* fixture;
        expect(statusOfANonOwnerBindingOnARelativeDeclarationRoute).toBe("unregistered");
      }),
    );
  });

  describe("a relative route walking out of a consumer that does not exist", () => {
    const it = test.extend("statusOfARelativeRouteFromAConsumerThatIsNotThere", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "../../order-vocabulary/src/order-status.ts",
          filename: "/repository/packages/consumer/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("cannot claim an owner", ({ statusOfARelativeRouteFromAConsumerThatIsNotThere }) => {
      expect(statusOfARelativeRouteFromAConsumerThatIsNotThere).toBe("unregistered");
    });
  });

  describe("an absolute repository path naming the declaration", () => {
    const fixture = Effect.gen(function* statusOfAnAbsoluteRepositoryPathToTheDeclaration() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-absolute-owner-",
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
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: pathService.join(repositoryRoot, "src/order-status.ts"),
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("is registered", () =>
      Effect.gen(function* program() {
        const statusOfAnAbsoluteRepositoryPathToTheDeclaration = yield* fixture;
        expect(statusOfAnAbsoluteRepositoryPathToTheDeclaration).toBe("registered");
      }),
    );
  });

  describe("a binding the absolute repository path does not own", () => {
    const fixture = Effect.gen(function* statusOfANonOwnerBindingOnAnAbsoluteRepositoryPath() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-absolute-binding-",
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
      return importRouteStatus(
        {
          importedName: "PUBLIC_STATUSES",
          specifier: pathService.join(repositoryRoot, "src/order-status.ts"),
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("is unregistered", () =>
      Effect.gen(function* program() {
        const statusOfANonOwnerBindingOnAnAbsoluteRepositoryPath = yield* fixture;
        expect(statusOfANonOwnerBindingOnAnAbsoluteRepositoryPath).toBe("unregistered");
      }),
    );
  });

  describe("an absolute repository path beside the declaration", () => {
    const it = test.extend("statusOfAnAbsoluteRepositoryPathBesideTheDeclaration", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "/repository/packages/order-vocabulary/src/shadow.ts",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfAnAbsoluteRepositoryPathBesideTheDeclaration }) => {
      expect(statusOfAnAbsoluteRepositoryPathBesideTheDeclaration).toBe("unregistered");
    });
  });

  describe("an absolute path lying outside the repository", () => {
    const it = test.extend("statusOfAnAbsolutePathOutsideTheRepository", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "/vendor/order-status.ts",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is external", ({ statusOfAnAbsolutePathOutsideTheRepository }) => {
      expect(statusOfAnAbsolutePathOutsideTheRepository).toBe("external");
    });
  });

  describe("a configured path alias naming the declaration", () => {
    const fixture = Effect.gen(function* statusOfAPathAliasNamingTheDeclaration() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-alias-owner-",
      });

      yield* filesystem.makeDirectory(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src"),
        { recursive: true },
      );
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "packages/order/src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/owner": ["packages/order-vocabulary/src/order-status.ts"] },
          },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
        "export {};\n",
      );
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@internal/owner",
          filename: pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("keeps the repository route and is registered", () =>
      Effect.gen(function* program() {
        const statusOfAPathAliasNamingTheDeclaration = yield* fixture;
        expect(statusOfAPathAliasNamingTheDeclaration).toBe("registered");
      }),
    );
  });

  describe("a binding the aliased declaration does not own", () => {
    const fixture = Effect.gen(function* statusOfANonOwnerBindingOnAPathAlias() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-alias-binding-",
      });

      yield* filesystem.makeDirectory(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src"),
        { recursive: true },
      );
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "packages/order/src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/owner": ["packages/order-vocabulary/src/order-status.ts"] },
          },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
        "export {};\n",
      );
      return importRouteStatus(
        {
          importedName: "SHADOW_STATUSES",
          specifier: "@internal/owner",
          filename: pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("keeps the binding identity and is unregistered", () =>
      Effect.gen(function* program() {
        const statusOfANonOwnerBindingOnAPathAlias = yield* fixture;
        expect(statusOfANonOwnerBindingOnAPathAlias).toBe("unregistered");
      }),
    );
  });

  describe("a configured path alias naming a sibling of the declaration", () => {
    const fixture = Effect.gen(function* statusOfAPathAliasNamingASiblingModule() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-alias-sibling-",
      });

      yield* filesystem.makeDirectory(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src"),
        { recursive: true },
      );
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "packages/order/src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/shadow": ["packages/order-vocabulary/src/shadow.ts"] },
          },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src/shadow.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
        "export {};\n",
      );
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@internal/shadow",
          filename: pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("is unregistered", () =>
      Effect.gen(function* program() {
        const statusOfAPathAliasNamingASiblingModule = yield* fixture;
        expect(statusOfAPathAliasNamingASiblingModule).toBe("unregistered");
      }),
    );
  });

  describe("a configured path alias naming a module that is not there", () => {
    const fixture = Effect.gen(function* statusOfAPathAliasNamingAMissingModule() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-alias-missing-",
      });

      yield* filesystem.makeDirectory(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src"),
        { recursive: true },
      );
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "packages/order/src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/missing": ["packages/missing/statuses.ts"] },
          },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
        "export {};\n",
      );
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@internal/missing",
          filename: pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("stays inside the repository and is unregistered", () =>
      Effect.gen(function* program() {
        const statusOfAPathAliasNamingAMissingModule = yield* fixture;
        expect(statusOfAPathAliasNamingAMissingModule).toBe("unregistered");
      }),
    );
  });

  describe("a wildcard path alias naming a module that is not there", () => {
    const fixture = Effect.gen(function* statusOfAWildcardAliasNamingAMissingModule() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-alias-wildcard-",
      });

      yield* filesystem.makeDirectory(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src"),
        { recursive: true },
      );
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "packages/order/src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/missing/*": ["packages/missing/*"] },
          },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
        "export {};\n",
      );
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@internal/missing/statuses",
          filename: pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("stays inside the repository and is unregistered", () =>
      Effect.gen(function* program() {
        const statusOfAWildcardAliasNamingAMissingModule = yield* fixture;
        expect(statusOfAWildcardAliasNamingAMissingModule).toBe("unregistered");
      }),
    );
  });

  describe("a specifier no configured path alias matches", () => {
    const fixture = Effect.gen(function* statusOfASpecifierNoPathAliasMatches() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-alias-unmatched-",
      });

      yield* filesystem.makeDirectory(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src"),
        { recursive: true },
      );
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "packages/order/src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/owner": ["packages/order-vocabulary/src/order-status.ts"] },
          },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
        "export {};\n",
      );
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@vite/unresolved-alias",
          filename: pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("is external", () =>
      Effect.gen(function* program() {
        const statusOfASpecifierNoPathAliasMatches = yield* fixture;
        expect(statusOfASpecifierNoPathAliasMatches).toBe("external");
      }),
    );
  });

  describe("a bare specifier inside a repository that configures path aliases", () => {
    const fixture = Effect.gen(function* statusOfABareSpecifierBesidePathAliases() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-alias-bare-",
      });

      yield* filesystem.makeDirectory(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src"),
        { recursive: true },
      );
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "packages/order/src"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@internal/owner": ["packages/order-vocabulary/src/order-status.ts"] },
          },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order-vocabulary/src/order-status.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
        "export {};\n",
      );
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "order-statuses",
          filename: pathService.join(repositoryRoot, "packages/order/src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("is external", () =>
      Effect.gen(function* program() {
        const statusOfABareSpecifierBesidePathAliases = yield* fixture;
        expect(statusOfABareSpecifierBesidePathAliases).toBe("external");
      }),
    );
  });

  describe("a path alias a TypeScript config above the repository defines", () => {
    const fixture = Effect.gen(function* statusOfAnAliasDefinedAboveTheRepositoryRoot() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const enclosingDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-parent-config-",
      });

      const repositoryRoot = pathService.join(enclosingDirectory, "repository");
      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(enclosingDirectory, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: {
            baseUrl: ".",
            paths: { "@external/statuses": ["repository/src/statuses.ts"] },
          },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/statuses.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      const nestedCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@external/statuses",
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        nestedCatalog,
      );
    });

    it.effect("cannot redefine a route inside the repository", () =>
      Effect.gen(function* program() {
        const statusOfAnAliasDefinedAboveTheRepositoryRoot = yield* fixture;
        expect(statusOfAnAliasDefinedAboveTheRepositoryRoot).toBe("external");
      }),
    );
  });

  describe("a relative route the TypeScript resolver sends to the ts module", () => {
    const fixture = Effect.gen(function* statusOfARelativeRouteToTheResolvedModule() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-competing-relative-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: { module: "nodenext", moduleResolution: "nodenext" },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.tsx"),
        'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      const directCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./status.js",
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        directCatalog,
      );
    });

    it.effect("is registered", () =>
      Effect.gen(function* program() {
        const statusOfARelativeRouteToTheResolvedModule = yield* fixture;
        expect(statusOfARelativeRouteToTheResolvedModule).toBe("registered");
      }),
    );
  });

  describe("a relative route naming the competing extension", () => {
    const fixture = Effect.gen(function* statusOfARelativeRouteToTheCompetingModule() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-competing-rival-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: { module: "nodenext", moduleResolution: "nodenext" },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.tsx"),
        'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      const directCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./status.jsx",
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        directCatalog,
      );
    });

    it.effect("is unregistered", () =>
      Effect.gen(function* program() {
        const statusOfARelativeRouteToTheCompetingModule = yield* fixture;
        expect(statusOfARelativeRouteToTheCompetingModule).toBe("unregistered");
      }),
    );
  });

  describe("an absolute route the TypeScript resolver sends to the ts module", () => {
    const fixture = Effect.gen(function* statusOfAnAbsoluteRouteToTheResolvedModule() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-competing-absolute-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: { module: "nodenext", moduleResolution: "nodenext" },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.tsx"),
        'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      const directCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: pathService.join(repositoryRoot, "src/status.js"),
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        directCatalog,
      );
    });

    it.effect("is registered", () =>
      Effect.gen(function* program() {
        const statusOfAnAbsoluteRouteToTheResolvedModule = yield* fixture;
        expect(statusOfAnAbsoluteRouteToTheResolvedModule).toBe("registered");
      }),
    );
  });

  describe("an absolute route naming the competing extension", () => {
    const fixture = Effect.gen(function* statusOfAnAbsoluteRouteToTheCompetingModule() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-competing-rival-path-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: { module: "nodenext", moduleResolution: "nodenext" },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.ts"),
        '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/status.tsx"),
        'export const ORDER_STATUSES = ["draft", "published"] as const;\n',
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/consumer.ts"),
        "export {};\n",
      );
      const directCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: pathService.join(repositoryRoot, "src/status.jsx"),
          filename: pathService.join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        directCatalog,
      );
    });

    it.effect("is unregistered", () =>
      Effect.gen(function* program() {
        const statusOfAnAbsoluteRouteToTheCompetingModule = yield* fixture;
        expect(statusOfAnAbsoluteRouteToTheCompetingModule).toBe("unregistered");
      }),
    );
  });

  describe("a relative specifier the catalog does not resolve", () => {
    const it = test.extend("statusOfARelativeSpecifierTheCatalogDoesNotResolve", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./statuses.ts",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfARelativeSpecifierTheCatalogDoesNotResolve }) => {
      expect(statusOfARelativeSpecifierTheCatalogDoesNotResolve).toBe("unregistered");
    });
  });

  describe("a subpath specifier the catalog does not resolve", () => {
    const it = test.extend("statusOfASubpathSpecifierTheCatalogDoesNotResolve", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "#internal/statuses",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("is unregistered", ({ statusOfASubpathSpecifierTheCatalogDoesNotResolve }) => {
      expect(statusOfASubpathSpecifierTheCatalogDoesNotResolve).toBe("unregistered");
    });
  });

  describe("a subpath specifier the package manifest resolves to a published route", () => {
    const fixture = Effect.gen(function* statusOfAResolvedSubpathImport() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-subpath-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          imports: { "#internal/statuses": "./src/statuses.ts" },
          name: "@fixture/consumer",
          type: "module",
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/schema.ts"),
        "export {};\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/statuses.ts"),
        "export const ORDER_STATUSES = [];\n",
      );
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "#internal/statuses",
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/statuses.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["src/statuses.ts"],
                specifier: "#internal/statuses",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("is registered", () =>
      Effect.gen(function* program() {
        const statusOfAResolvedSubpathImport = yield* fixture;
        expect(statusOfAResolvedSubpathImport).toBe("registered");
      }),
    );
  });

  describe("a bare specifier that reaches no registered owner", () => {
    const it = test.extend("statusOfABareSpecifierNoOwnerClaims", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "order-statuses",
          filename: "/repository/packages/order/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/order-status.ts",
            declarationStart: 20,
            importRoutes: [
              {
                exportName: "ORDER_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/index.ts"],
                specifier: "@mst/order-vocabulary",
              },
              {
                exportName: "PUBLIC_STATUSES",
                resolvedSourcePaths: ["packages/order-vocabulary/src/alias.ts"],
                specifier: "@mst/order-vocabulary/alias",
              },
            ],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("comes from outside the repository", ({ statusOfABareSpecifierNoOwnerClaims }) => {
      expect(statusOfABareSpecifierNoOwnerClaims).toBe("external");
    });
  });

  describe("a declaration reached through an index module", () => {
    const fixture = Effect.gen(function* statusOfADeclarationReachedThroughAnIndexModule() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-index-module-",
      });

      yield* filesystem.makeDirectory(pathService.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/index.ts"),
        "export const ORDER_STATUSES = [] as const;\n",
      );
      yield* filesystem.writeFileString(
        pathService.join(repositoryRoot, "src/schema.ts"),
        "export {};\n",
      );
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./index.ts",
          filename: pathService.join(repositoryRoot, "src/schema.ts"),
          repositoryRoot,
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "src/index.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      );
    });

    it.effect("keeps resolving to its owner and is registered", () =>
      Effect.gen(function* program() {
        const statusOfADeclarationReachedThroughAnIndexModule = yield* fixture;
        expect(statusOfADeclarationReachedThroughAnIndexModule).toBe("registered");
      }),
    );
  });

  describe("a route naming the directory a declaration's index module sits in", () => {
    const it = test.extend("statusOfASiblingRouteBesideADirectoryIndexOwner", () =>
      importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "./status",
          filename: "/repository/packages/order-vocabulary/src/schema.ts",
          repositoryRoot: "/repository",
        },
        buildCatalog([
          {
            annotationStart: 0,
            binding: "ORDER_STATUSES",
            bindingStart: 40,
            conceptId: "order.status",
            declarationEnd: 80,
            declarationPath: "packages/order-vocabulary/src/status/index.ts",
            declarationStart: 20,
            importRoutes: [],
            packageName: "@mst/order-vocabulary",
            values: ["draft", "published"],
            fingerprint: fingerprintValues(["draft", "published"]),
          },
        ]),
      ));

    it("does not capture the sibling file", ({
      statusOfASiblingRouteBesideADirectoryIndexOwner,
    }) => {
      expect(statusOfASiblingRouteBesideADirectoryIndexOwner).toBe("unregistered");
    });
  });
});
