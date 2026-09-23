import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { attempt } from "es-toolkit";
import * as ts from "typescript-6";
import { describe, expect } from "vite-plus/test";

import { path } from "../../../../platform/path.ts";
import {
  canonicalValuesTypeScriptConfigPath,
  createCanonicalValuesTypeScriptProgram,
} from "./typescript-program.ts";

const BASE_SOURCE = 'export const BASE = ["draft"] as const;\n';
const OWNER_SOURCE =
  'import { BASE } from "@internal/base";\nexport const OWNER = [...BASE, "published"] as const;\n';

layer(NodeServices.layer)("createCanonicalValuesTypeScriptProgram", (it) => {
  describe("sibling source directories under one repository configuration", () => {
    const fixture = Effect.gen(function* siblingConfigPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const siblingRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-typescript-program-sibling-",
      });
      yield* filesystem.makeDirectory(pathService.join(siblingRoot, "src"), { recursive: true });

      yield* filesystem.writeFileString(pathService.join(siblingRoot, "tsconfig.json"), "{}");
      return {
        siblingRoot,
        siblingConfigPaths: ["src/first", "src/second"].map((searchDirectory) =>
          canonicalValuesTypeScriptConfigPath({
            repositoryRoot: siblingRoot,
            searchDirectory: path.join(siblingRoot, searchDirectory),
          }),
        ),
      };
    });

    it.effect("resolve to one configuration identity", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { siblingRoot, siblingConfigPaths } = yield* fixture;
        expect(siblingConfigPaths).toStrictEqual([
          pathService.join(siblingRoot, "tsconfig.json"),
          pathService.join(siblingRoot, "tsconfig.json"),
        ]);
      }),
    );
  });

  describe("a nested configuration standing beside the repository configuration", () => {
    const fixture = Effect.gen(function* nestedConfigPaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const nestedRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-typescript-program-nested-",
      });
      yield* filesystem.makeDirectory(pathService.join(nestedRoot, "src"), { recursive: true });
      yield* filesystem.makeDirectory(pathService.join(nestedRoot, "packages/nested/src"), {
        recursive: true,
      });

      yield* filesystem.writeFileString(pathService.join(nestedRoot, "tsconfig.json"), "{}");
      yield* filesystem.writeFileString(
        pathService.join(nestedRoot, "packages/nested/tsconfig.json"),
        "{}",
      );
      return {
        nestedRoot,
        nestedConfigPaths: ["src", "packages/nested/src"].map((searchDirectory) =>
          canonicalValuesTypeScriptConfigPath({
            repositoryRoot: nestedRoot,
            searchDirectory: path.join(nestedRoot, searchDirectory),
          }),
        ),
      };
    });

    it.effect("stay distinct program identities", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { nestedRoot, nestedConfigPaths } = yield* fixture;
        expect(nestedConfigPaths).toStrictEqual([
          pathService.join(nestedRoot, "tsconfig.json"),
          pathService.join(nestedRoot, "packages/nested/tsconfig.json"),
        ]);
      }),
    );
  });

  describe("a paths mapping declared by the nearest repository configuration", () => {
    const fixture = Effect.gen(function* mappedOwnerType() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const mappingRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-typescript-program-mapping-",
      });
      yield* filesystem.makeDirectory(pathService.join(mappingRoot, "src"), { recursive: true });

      yield* filesystem.writeFileString(
        pathService.join(mappingRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: { baseUrl: ".", paths: { "@internal/base": ["src/base.ts"] } },
        }),
      );
      yield* filesystem.writeFileString(pathService.join(mappingRoot, "src/base.ts"), BASE_SOURCE);
      const ownerPath = pathService.join(mappingRoot, "src/owner.ts");
      yield* filesystem.writeFileString(ownerPath, OWNER_SOURCE);
      const program = createCanonicalValuesTypeScriptProgram({
        repositoryRoot: mappingRoot,
        rootNames: [ownerPath],
        searchDirectory: pathService.join(mappingRoot, "src"),
      });
      const [, ownerStatement] = program.getSourceFile(ownerPath)?.statements ?? [];
      if (ownerStatement === undefined || !ts.isVariableStatement(ownerStatement)) {
        throw new Error("owner.ts did not parse into a variable statement");
      }
      const [ownerDeclaration] = ownerStatement.declarationList.declarations;
      if (ownerDeclaration === undefined) throw new Error("owner.ts declared no binding");
      return program
        .getTypeChecker()
        .typeToString(program.getTypeChecker().getTypeAtLocation(ownerDeclaration.name));
    });

    it.effect("widens the owner to the mapped tuple", () =>
      Effect.gen(function* program() {
        const mappedOwnerType = yield* fixture;
        expect(mappedOwnerType).toBe('readonly ["draft", "published"]');
      }),
    );
  });

  describe("a configuration sitting above the repository root", () => {
    const fixture = Effect.gen(function* unmappedOwnerType() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const outsideConfigRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-typescript-program-above-",
      });
      yield* filesystem.makeDirectory(pathService.join(outsideConfigRoot, "nested/src"), {
        recursive: true,
      });

      yield* filesystem.writeFileString(
        pathService.join(outsideConfigRoot, "tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: { baseUrl: ".", paths: { "@internal/base": ["base.ts"] } },
        }),
      );
      yield* filesystem.writeFileString(
        pathService.join(outsideConfigRoot, "base.ts"),
        BASE_SOURCE,
      );
      const ownerPath = pathService.join(outsideConfigRoot, "nested/src/owner.ts");
      yield* filesystem.writeFileString(ownerPath, OWNER_SOURCE);
      const program = createCanonicalValuesTypeScriptProgram({
        repositoryRoot: pathService.join(outsideConfigRoot, "nested"),
        rootNames: [ownerPath],
        searchDirectory: pathService.join(outsideConfigRoot, "nested/src"),
      });
      const [, ownerStatement] = program.getSourceFile(ownerPath)?.statements ?? [];
      if (ownerStatement === undefined || !ts.isVariableStatement(ownerStatement)) {
        throw new Error("owner.ts did not parse into a variable statement");
      }
      const [ownerDeclaration] = ownerStatement.declarationList.declarations;
      if (ownerDeclaration === undefined) throw new Error("owner.ts declared no binding");
      return program
        .getTypeChecker()
        .typeToString(program.getTypeChecker().getTypeAtLocation(ownerDeclaration.name));
    });

    it.effect("is left out of the program", () =>
      Effect.gen(function* program() {
        const unmappedOwnerType = yield* fixture;
        expect(unmappedOwnerType).toBe('readonly [...any[], "published"]');
      }),
    );
  });

  describe("a configuration extending a file outside the repository", () => {
    const fixture = Effect.gen(function* outsideExtendsFailure() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const outsideExtendsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-typescript-program-extends-",
      });
      yield* filesystem.makeDirectory(pathService.join(outsideExtendsRoot, "nested/src"), {
        recursive: true,
      });

      yield* filesystem.writeFileString(
        pathService.join(outsideExtendsRoot, "base.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({ compilerOptions: {} }),
      );
      yield* filesystem.writeFileString(
        pathService.join(outsideExtendsRoot, "nested/tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          extends: "../base.json",
        }),
      );
      const ownerPath = pathService.join(outsideExtendsRoot, "nested/src/owner.ts");
      yield* filesystem.writeFileString(
        ownerPath,
        'export const OWNER = ["draft", "published"] as const;\n',
      );
      const [failure] = attempt<ts.Program, Error>(() =>
        createCanonicalValuesTypeScriptProgram({
          repositoryRoot: path.join(outsideExtendsRoot, "nested"),
          rootNames: [ownerPath],
          searchDirectory: path.join(outsideExtendsRoot, "nested/src"),
        }),
      );
      return {
        outsideExtendsRoot,
        outsideExtendsFailure: failure === null ? null : failure.message,
      };
    });

    it.effect("is refused by name", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { outsideExtendsRoot, outsideExtendsFailure } = yield* fixture;
        expect(outsideExtendsFailure).toBe(
          `TypeScript config extends outside the repository: ${pathService.join(outsideExtendsRoot, "base.json")}`,
        );
      }),
    );
  });

  describe("a paths target sitting outside the cache-bounded repository", () => {
    const fixture = Effect.gen(function* outsideTargetFailure() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const outsideTargetRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-typescript-program-target-",
      });
      yield* filesystem.makeDirectory(pathService.join(outsideTargetRoot, "nested/src"), {
        recursive: true,
      });

      yield* filesystem.writeFileString(
        pathService.join(outsideTargetRoot, "base.ts"),
        BASE_SOURCE,
      );
      yield* filesystem.writeFileString(
        pathService.join(outsideTargetRoot, "nested/tsconfig.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          compilerOptions: { baseUrl: ".", paths: { "@external/base": ["../base.ts"] } },
        }),
      );
      const ownerPath = pathService.join(outsideTargetRoot, "nested/src/owner.ts");
      yield* filesystem.writeFileString(
        ownerPath,
        'import { BASE } from "@external/base";\nexport const OWNER = [...BASE, "published"] as const;\n',
      );
      const [failure] = attempt<ts.Program, Error>(() =>
        createCanonicalValuesTypeScriptProgram({
          repositoryRoot: path.join(outsideTargetRoot, "nested"),
          rootNames: [ownerPath],
          searchDirectory: path.join(outsideTargetRoot, "nested/src"),
        }),
      );
      return { outsideTargetRoot, outsideTargetFailure: failure === null ? null : failure.message };
    });

    it.effect("is refused by name", () =>
      Effect.gen(function* program() {
        const pathService = yield* Path.Path;
        const { outsideTargetRoot, outsideTargetFailure } = yield* fixture;
        expect(outsideTargetFailure).toBe(
          `TypeScript dependency is outside the repository: ${pathService.join(outsideTargetRoot, "base.ts")}`,
        );
      }),
    );
  });

  describe("a malformed TypeScript configuration", () => {
    const fixture = Effect.gen(function* malformedConfigFailure() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const malformedRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-typescript-program-malformed-",
      });
      yield* filesystem.makeDirectory(pathService.join(malformedRoot, "src"), { recursive: true });

      yield* filesystem.writeFileString(
        pathService.join(malformedRoot, "tsconfig.json"),
        '{ "compilerOptions": { "module": 1 }',
      );
      const ownerPath = pathService.join(malformedRoot, "src/owner.ts");
      yield* filesystem.writeFileString(
        ownerPath,
        'export const OWNER = ["draft", "published"] as const;\n',
      );
      const [failure] = attempt<ts.Program, Error>(() =>
        createCanonicalValuesTypeScriptProgram({
          repositoryRoot: malformedRoot,
          rootNames: [ownerPath],
          searchDirectory: path.join(malformedRoot, "src"),
        }),
      );
      return failure === null ? null : failure.message;
    });

    it.effect("surfaces its first diagnostic", () =>
      Effect.gen(function* program() {
        const malformedConfigFailure = yield* fixture;
        expect(malformedConfigFailure).toBe(
          "Compiler option 'module' requires a value of type string.",
        );
      }),
    );
  });

  describe("a tsx source override", () => {
    const fixture = Effect.gen(function* tsxOverrideSyntaxErrors() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const tsxRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-typescript-program-tsx-",
      });
      yield* filesystem.makeDirectory(pathService.join(tsxRoot, "src"), { recursive: true });

      const sourcePath = pathService.join(tsxRoot, "src/owner.tsx");
      const program = createCanonicalValuesTypeScriptProgram({
        repositoryRoot: tsxRoot,
        rootNames: [sourcePath],
        searchDirectory: pathService.join(tsxRoot, "src"),
        sourceOverrides: new Map([[sourcePath, "export const view = <main />;\n"]]),
      });
      const overriddenSource = program.getSourceFile(sourcePath);
      if (overriddenSource === undefined) throw new Error("the source override was not parsed");
      return program
        .getSyntacticDiagnostics(overriddenSource)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    });

    it.effect("carries jsx that only the jsx script kind accepts", () =>
      Effect.gen(function* program() {
        const tsxOverrideSyntaxErrors = yield* fixture;
        expect(tsxOverrideSyntaxErrors).toStrictEqual([]);
      }),
    );
  });

  describe("a ts source override", () => {
    const fixture = Effect.gen(function* tsOverrideSyntaxErrors() {
      const filesystem = yield* FileSystem.FileSystem;
      const pathService = yield* Path.Path;
      const tsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-typescript-program-ts-",
      });
      yield* filesystem.makeDirectory(pathService.join(tsRoot, "src"), { recursive: true });

      const sourcePath = pathService.join(tsRoot, "src/owner.ts");
      const program = createCanonicalValuesTypeScriptProgram({
        repositoryRoot: tsRoot,
        rootNames: [sourcePath],
        searchDirectory: pathService.join(tsRoot, "src"),
        sourceOverrides: new Map([[sourcePath, 'export const label = <string>"draft";\n']]),
      });
      const overriddenSource = program.getSourceFile(sourcePath);
      if (overriddenSource === undefined) throw new Error("the source override was not parsed");
      return program
        .getSyntacticDiagnostics(overriddenSource)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    });

    it.effect("carries an assertion that only the standard script kind accepts", () =>
      Effect.gen(function* program() {
        const tsOverrideSyntaxErrors = yield* fixture;
        expect(tsOverrideSyntaxErrors).toStrictEqual([]);
      }),
    );
  });
});
