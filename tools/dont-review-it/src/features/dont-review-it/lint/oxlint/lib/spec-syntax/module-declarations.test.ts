import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { importedDeclarationOf, moduleDeclarationsOf } from "./module-declarations.ts";

import type { SpecStatement } from "./subject-expressions.ts";

describe("moduleDeclarationsOf", () => {
  describe("a module exporting a constant", () => {
    const it = test.extend("namesAndKindsBoundInAModuleExportingAConstant", () =>
      [
        ...moduleDeclarationsOf(
          "shape.ts",
          parseSync("shape.ts", "export const ordered = (rows) => rows.sort();").program.body.map(
            (statement) => statement as SpecStatement,
          ),
        ).initializerByName,
      ].map(([boundName, bound]) => [boundName, bound.type]));

    it("names the value that constant is bound to", ({
      namesAndKindsBoundInAModuleExportingAConstant,
    }) => {
      expect(namesAndKindsBoundInAModuleExportingAConstant).toStrictEqual([
        ["ordered", "ArrowFunctionExpression"],
      ]);
    });
  });

  describe("a module exporting a function", () => {
    const it = test.extend("namesAndKindsBoundInAModuleExportingAFunction", () =>
      [
        ...moduleDeclarationsOf(
          "shape.ts",
          parseSync(
            "shape.ts",
            "export function ordered(rows) {\n  return rows;\n}",
          ).program.body.map((statement) => statement as SpecStatement),
        ).initializerByName,
      ].map(([boundName, bound]) => [boundName, bound.type]));

    it("names the function that declaration introduces", ({
      namesAndKindsBoundInAModuleExportingAFunction,
    }) => {
      expect(namesAndKindsBoundInAModuleExportingAFunction).toStrictEqual([
        ["ordered", "FunctionDeclaration"],
      ]);
    });
  });

  describe("a declaration written without a name", () => {
    const it = test.extend("namesAndKindsBoundByADeclarationWithoutAName", () =>
      [
        ...moduleDeclarationsOf(
          "shape.ts",
          parseSync("shape.ts", "export default function () {}").program.body.map(
            (statement) => statement as SpecStatement,
          ),
        ).initializerByName,
      ].map(([boundName, bound]) => [boundName, bound.type]));

    it("is nothing this reading can look up", ({
      namesAndKindsBoundByADeclarationWithoutAName,
    }) => {
      expect(namesAndKindsBoundByADeclarationWithoutAName).toStrictEqual([]);
    });
  });

  describe("bindings written without an initialiser", () => {
    const it = test.extend("namesAndKindsBoundByBindingsWithoutAnInitialiser", () =>
      [
        ...moduleDeclarationsOf(
          "shape.ts",
          parseSync(
            "shape.ts",
            "let ordered;\nconst [head] = rows;\ndeclare const listed: string;",
          ).program.body.map((statement) => statement as SpecStatement),
        ).initializerByName,
      ].map(([boundName, bound]) => [boundName, bound.type]));

    it("are nothing this reading can look up", ({
      namesAndKindsBoundByBindingsWithoutAnInitialiser,
    }) => {
      expect(namesAndKindsBoundByBindingsWithoutAnInitialiser).toStrictEqual([]);
    });
  });

  describe("a name brought in under an alias", () => {
    const it = test.extend("originOfAnImportedName", () =>
      moduleDeclarationsOf(
        "spec.ts",
        parseSync(
          "spec.ts",
          'import { ordered as arranged } from "./shape.ts";\nimport widen from "./widen.ts";\n',
        ).program.body.map((statement) => statement as SpecStatement),
      ).importedByName.get("arranged"));

    it("is named together with where it comes from", ({ originOfAnImportedName }) => {
      expect(originOfAnImportedName).toStrictEqual({
        specifier: "./shape.ts",
        exported: "ordered",
      });
    });
  });

  describe("a name exported under another spelling", () => {
    const it = test.extend("localBindingBehindAnExportedName", () =>
      moduleDeclarationsOf(
        "shape.ts",
        parseSync(
          "shape.ts",
          "const ordered = rows;\nexport { ordered as sorted };",
        ).program.body.map((statement) => statement as SpecStatement),
      ).localNameByExported.get("sorted"));

    it("is named together with the local binding behind it", ({
      localBindingBehindAnExportedName,
    }) => {
      expect(localBindingBehindAnExportedName).toBe("ordered");
    });
  });

  describe("a name forwarded from another module", () => {
    const it = test.extend("moduleBehindAForwardedName", () =>
      moduleDeclarationsOf(
        "index.ts",
        parseSync("index.ts", 'export { ordered } from "./shape.ts";').program.body.map(
          (statement) => statement as SpecStatement,
        ),
      ).forwardedByExported.get("ordered"));

    it("is named together with the module behind it", ({ moduleBehindAForwardedName }) => {
      expect(moduleBehindAForwardedName).toStrictEqual({
        specifier: "./shape.ts",
        exported: "ordered",
      });
    });
  });

  describe("a module forwarding another module wholesale", () => {
    const it = test.extend("declarationsOfAModuleForwardingWholesale", () =>
      moduleDeclarationsOf(
        "index.ts",
        parseSync(
          "index.ts",
          'export * from "./shape.ts";\nexport * as shape from "./shape.ts";',
        ).program.body.map((statement) => statement as SpecStatement),
      ));

    it("names every module it forwards", ({ declarationsOfAModuleForwardingWholesale }) => {
      expect(declarationsOfAModuleForwardingWholesale).toStrictEqual({
        filename: "index.ts",
        initializerByName: new Map(),
        importedByName: new Map(),
        localNameByExported: new Map(),
        forwardedByExported: new Map(),
        forwardedSpecifiers: ["./shape.ts"],
      });
    });
  });
});

layer(NodeServices.layer)("importedDeclarationOf", (it) => {
  describe("a name reached through a dependency", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const declarationReachedThroughADependency = yield* Effect.gen(
        function* declarationReachedThroughADependency() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "dependency");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          return importedDeclarationOf({
            from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
            imported: { specifier: "es-toolkit", exported: "sortBy" },
            visited: new Set<string>(),
          });
        },
      );
      return { moduleDeclarationsRoot, declarationReachedThroughADependency };
    });

    it.effect("is judged by its spelling alone", () =>
      Effect.gen(function* program() {
        const { declarationReachedThroughADependency } = yield* fixtures;
        expect(declarationReachedThroughADependency).toBe(null);
      }),
    );
  });

  describe("a module that is not on disk", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const declarationReachedThroughAModuleThatIsNotOnDisk = yield* Effect.gen(
        function* declarationReachedThroughAModuleThatIsNotOnDisk() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "absent");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          return importedDeclarationOf({
            from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
            imported: { specifier: "./absent.ts", exported: "ordered" },
            visited: new Set<string>(),
          });
        },
      );
      return { moduleDeclarationsRoot, declarationReachedThroughAModuleThatIsNotOnDisk };
    });

    it.effect("hands back nothing to read", () =>
      Effect.gen(function* program() {
        const { declarationReachedThroughAModuleThatIsNotOnDisk } = yield* fixtures;
        expect(declarationReachedThroughAModuleThatIsNotOnDisk).toBe(null);
      }),
    );
  });

  describe("a name the module never declares", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const declarationOfANameTheModuleNeverDeclares = yield* Effect.gen(
        function* declarationOfANameTheModuleNeverDeclares() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "bare");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(directory, "bare.ts"),
            "export const widen = (rows) => rows;\n",
          );
          return importedDeclarationOf({
            from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
            imported: { specifier: "./bare.ts", exported: "ordered" },
            visited: new Set<string>(),
          });
        },
      );
      return { moduleDeclarationsRoot, declarationOfANameTheModuleNeverDeclares };
    });

    it.effect("hands back nothing to read either", () =>
      Effect.gen(function* program() {
        const { declarationOfANameTheModuleNeverDeclares } = yield* fixtures;
        expect(declarationOfANameTheModuleNeverDeclares).toBe(null);
      }),
    );
  });

  describe("a name declared in the imported module", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const readingOfANameDeclaredInTheImportedModule = yield* Effect.gen(
        function* readingOfANameDeclaredInTheImportedModule() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "declared");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(directory, "shape.ts"),
            "export const ordered = (rows) => rows.sort();\n",
          );
          return [
            importedDeclarationOf({
              from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
              imported: { specifier: "./shape.ts", exported: "ordered" },
              visited: new Set<string>(),
            }),
          ].map((found) => ({ kind: found?.declared.type, module: found?.module.filename }));
        },
      );
      return { moduleDeclarationsRoot, readingOfANameDeclaredInTheImportedModule };
    });

    it.effect("resolves to what it is bound to", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { readingOfANameDeclaredInTheImportedModule, moduleDeclarationsRoot } =
          yield* fixtures;
        expect(readingOfANameDeclaredInTheImportedModule).toStrictEqual([
          {
            kind: "ArrowFunctionExpression",
            module: paths.join(moduleDeclarationsRoot, "declared", "shape.ts"),
          },
        ]);
      }),
    );
  });

  describe("a name exported under an alias", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const kindBehindANameExportedUnderAnAlias = yield* Effect.gen(
        function* kindBehindANameExportedUnderAnAlias() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "aliased");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(directory, "aliased.ts"),
            "const ordered = (rows) => rows.sort();\nexport { ordered as sorted };\n",
          );
          return [
            importedDeclarationOf({
              from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
              imported: { specifier: "./aliased.ts", exported: "sorted" },
              visited: new Set<string>(),
            }),
          ].map((found) => found?.declared.type);
        },
      );
      return { moduleDeclarationsRoot, kindBehindANameExportedUnderAnAlias };
    });

    it.effect("resolves to the binding behind the alias", () =>
      Effect.gen(function* program() {
        const { kindBehindANameExportedUnderAnAlias } = yield* fixtures;
        expect(kindBehindANameExportedUnderAnAlias).toStrictEqual(["ArrowFunctionExpression"]);
      }),
    );
  });

  describe("a name re-exported from another module", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const moduleBehindANameReExportedFromAnotherModule = yield* Effect.gen(
        function* moduleBehindANameReExportedFromAnotherModule() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "re-exported");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(directory, "shape.ts"),
            "export const ordered = (rows) => rows.sort();\n",
          );
          yield* filesystem.writeFileString(
            paths.join(directory, "re-exported.ts"),
            'export { ordered } from "./shape.ts";\n',
          );
          return [
            importedDeclarationOf({
              from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
              imported: { specifier: "./re-exported.ts", exported: "ordered" },
              visited: new Set<string>(),
            }),
          ].map((found) => found?.module.filename);
        },
      );
      return { moduleDeclarationsRoot, moduleBehindANameReExportedFromAnotherModule };
    });

    it.effect("is followed to that module", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { moduleBehindANameReExportedFromAnotherModule, moduleDeclarationsRoot } =
          yield* fixtures;
        expect(moduleBehindANameReExportedFromAnotherModule).toStrictEqual([
          paths.join(moduleDeclarationsRoot, "re-exported", "shape.ts"),
        ]);
      }),
    );
  });

  describe("a name that arrives by import and leaves by export", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const moduleBehindANameThatArrivesByImportAndLeavesByExport = yield* Effect.gen(
        function* moduleBehindANameThatArrivesByImportAndLeavesByExport() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "passed-on");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(directory, "shape.ts"),
            "export const ordered = (rows) => rows.sort();\n",
          );
          yield* filesystem.writeFileString(
            paths.join(directory, "passed-on.ts"),
            'import { ordered } from "./shape.ts";\nexport { ordered };\n',
          );
          return [
            importedDeclarationOf({
              from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
              imported: { specifier: "./passed-on.ts", exported: "ordered" },
              visited: new Set<string>(),
            }),
          ].map((found) => found?.module.filename);
        },
      );
      return { moduleDeclarationsRoot, moduleBehindANameThatArrivesByImportAndLeavesByExport };
    });

    it.effect("is followed to its source", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { moduleBehindANameThatArrivesByImportAndLeavesByExport, moduleDeclarationsRoot } =
          yield* fixtures;
        expect(moduleBehindANameThatArrivesByImportAndLeavesByExport).toStrictEqual([
          paths.join(moduleDeclarationsRoot, "passed-on", "shape.ts"),
        ]);
      }),
    );
  });

  describe("a name forwarded wholesale", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const moduleBehindANameForwardedWholesale = yield* Effect.gen(
        function* moduleBehindANameForwardedWholesale() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "barrel");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(directory, "shape.ts"),
            "export const ordered = (rows) => rows.sort();\n",
          );
          yield* filesystem.writeFileString(
            paths.join(directory, "barrel.ts"),
            'export * from "./absent.ts";\nexport * from "./shape.ts";\n',
          );
          return [
            importedDeclarationOf({
              from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
              imported: { specifier: "./barrel.ts", exported: "ordered" },
              visited: new Set<string>(),
            }),
          ].map((found) => found?.module.filename);
        },
      );
      return { moduleDeclarationsRoot, moduleBehindANameForwardedWholesale };
    });

    it.effect("is followed into the forwarded module", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { moduleBehindANameForwardedWholesale, moduleDeclarationsRoot } = yield* fixtures;
        expect(moduleBehindANameForwardedWholesale).toStrictEqual([
          paths.join(moduleDeclarationsRoot, "barrel", "shape.ts"),
        ]);
      }),
    );
  });

  describe("a forwarding cycle", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const declarationReachedThroughAForwardingCycle = yield* Effect.gen(
        function* declarationReachedThroughAForwardingCycle() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "looping");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(directory, "looping.ts"),
            'export * from "./looping.ts";\n',
          );
          return importedDeclarationOf({
            from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
            imported: { specifier: "./looping.ts", exported: "ordered" },
            visited: new Set<string>(),
          });
        },
      );
      return { moduleDeclarationsRoot, declarationReachedThroughAForwardingCycle };
    });

    it.effect("stops at the module it has already read", () =>
      Effect.gen(function* program() {
        const { declarationReachedThroughAForwardingCycle } = yield* fixtures;
        expect(declarationReachedThroughAForwardingCycle).toBe(null);
      }),
    );
  });

  describe("a spelling written as a string in an export clause", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const moduleDeclarationsRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-module-declarations-",
      });
      const kindBehindASpellingWrittenAsAStringInAnExportClause = yield* Effect.gen(
        function* kindBehindASpellingWrittenAsAStringInAnExportClause() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const directory = paths.join(moduleDeclarationsRoot, "quoted");
          yield* filesystem.makeDirectory(directory, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(directory, "quoted.ts"),
            'const ordered = (rows) => rows.sort();\nexport { ordered as "sorted" };\n',
          );
          return [
            importedDeclarationOf({
              from: moduleDeclarationsOf(paths.join(directory, "spec.ts"), []),
              imported: { specifier: "./quoted.ts", exported: "sorted" },
              visited: new Set<string>(),
            }),
          ].map((found) => found?.declared.type);
        },
      );
      return { moduleDeclarationsRoot, kindBehindASpellingWrittenAsAStringInAnExportClause };
    });

    it.effect("reads as the same name", () =>
      Effect.gen(function* program() {
        const { kindBehindASpellingWrittenAsAStringInAnExportClause } = yield* fixtures;
        expect(kindBehindASpellingWrittenAsAStringInAnExportClause).toStrictEqual([
          "ArrowFunctionExpression",
        ]);
      }),
    );
  });
});
