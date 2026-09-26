import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { stopAiSlop } from "../run-cli.ts";
import { scopedCallExpressionsIn } from "./scoped-call-expressions.ts";

class GitFixtureRefused extends Schema.TaggedError<GitFixtureRefused>()("GitFixtureRefused", {
  command: Schema.String,
  exitCode: Schema.Finite,
  stderr: Schema.String,
}) {}

const git = Effect.fn("git")(function* git(
  repositoryRoot: string,
  gitArguments: readonly string[],
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make("git", [...gitArguments], {
      cwd: repositoryRoot,
      env: {
        GIT_AUTHOR_EMAIL: "scoped-call-expressions@example.test",
        GIT_AUTHOR_NAME: "Scoped Call Expressions",
        GIT_COMMITTER_EMAIL: "scoped-call-expressions@example.test",
        GIT_COMMITTER_NAME: "Scoped Call Expressions",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
        HOME: repositoryRoot,
        PATH: yield* Config.String("PATH"),
      },
      stdin: "ignore",
    }),
  );
  const [answered, refusal, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode,
    ],
    { concurrency: "unbounded" },
  );
  return exitCode === 0
    ? answered
    : yield* GitFixtureRefused.make({ command: gitArguments.join(" "), exitCode, stderr: refusal });
}, Effect.scoped);

const writeSource = Effect.fn("writeSource")(function* writeSource(
  repositoryRoot: string,
  relativePath: string,
  sourceText: string,
) {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const absolutePath = paths.join(repositoryRoot, relativePath);
  yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
  yield* filesystem.writeFileString(absolutePath, sourceText);
});

const removeSource = Effect.fn("removeSource")(function* removeSource(
  repositoryRoot: string,
  relativePath: string,
) {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  yield* filesystem.remove(paths.join(repositoryRoot, relativePath));
});

const commitSnapshot = Effect.fn("commitSnapshot")(function* commitSnapshot(
  repositoryRoot: string,
) {
  yield* git(repositoryRoot, ["add", "--all"]);
  yield* git(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
});

const newRepository = Effect.gen(function* newRepository() {
  const filesystem = yield* FileSystem.FileSystem;
  const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
    prefix: "scoped-call-expressions-",
  });
  yield* git(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);
  return repositoryRoot;
});

const lastCommitAnswer = Effect.fn("lastCommitAnswer")(function* lastCommitAnswer(
  repositoryRoot: string,
) {
  yield* git(repositoryRoot, ["update-ref", "refs/remotes/origin/main", "HEAD~1"]);
  return yield* stopAiSlop({ repositoryRoot });
});

describe("scopedCallExpressionsIn", () => {
  describe("a program of held declarations and destructuring patterns", () => {
    const it = test.extend("programScopeBindings", () => {
      const source = `
        export const { property: assigned = true, ...objectRest } = sourceObject;
        export const [arrayValue, ...arrayRest] = sourceArray;
        export default function exportedFunction() {}
        class DeclaredClass {}
        export { DeclaredClass };
        enum DeclaredEnum { Value }
        namespace DeclaredNamespace {}
        import importedValue = Other.value;
        target();
      `;
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ localBindings }) => [...localBindings],
      );
    });

    it("collects held declarations and destructured bindings in a program", ({
      programScopeBindings,
    }) => {
      expect(programScopeBindings).toStrictEqual([
        "assigned",
        "objectRest",
        "arrayValue",
        "arrayRest",
        "exportedFunction",
        "DeclaredClass",
        "DeclaredEnum",
        "DeclaredNamespace",
        "importedValue",
      ]);
    });
  });

  describe("catch, loop, switch, class, and named function scopes around the same call", () => {
    const it = test.extend("targetCallBindings", () => {
      const source = [
        "function namedFunction({ value: functionBinding }) { target(); }",
        "const namedExpression = function innerName() { target(); };",
        "try {} catch (caught) { target(); }",
        "for (let initialized = 0; initialized < 1; initialized += 1) { target(); }",
        "for (const forOfBinding of []) { target(); }",
        "for (const forInBinding in {}) { target(); }",
        "switch (true) { case true: const switched = true; target(); }",
        "const NamedClass = class InnerClass { method() { target(); } };",
      ].join("\n");
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program)
        .filter(({ call }) => call.callee.type === "Identifier" && call.callee.name === "target")
        .map(({ localBindings }) => [...localBindings]);
    });

    it("tracks catch, loop, switch, class, and named function scopes", ({ targetCallBindings }) => {
      expect(targetCallBindings).toStrictEqual([
        ["namedFunction", "namedExpression", "NamedClass", "functionBinding"],
        ["namedFunction", "namedExpression", "NamedClass", "innerName"],
        ["namedFunction", "namedExpression", "NamedClass", "caught"],
        ["namedFunction", "namedExpression", "NamedClass", "initialized"],
        ["namedFunction", "namedExpression", "NamedClass", "forOfBinding"],
        ["namedFunction", "namedExpression", "NamedClass", "forInBinding"],
        ["namedFunction", "namedExpression", "NamedClass", "switched"],
        ["namedFunction", "namedExpression", "NamedClass", "InnerClass"],
      ]);
    });
  });

  describe("a var declared under a branch inside a class static block", () => {
    const it = test.extend("staticBlockExpectBindingStates", () => {
      const source =
        "class Probe { static { if (true) { var expect = (value: boolean) => held; } expect(true); } }";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ call, localBindings }) =>
          call.callee.type === "Identifier" && call.callee.name === "expect"
            ? [localBindings.has("expect")]
            : [],
      );
    });

    it("hoists var bindings inside a class static block", ({ staticBlockExpectBindingStates }) => {
      expect(staticBlockExpectBindingStates).toStrictEqual([true]);
    });
  });

  describe("a var declared under a branch inside a TypeScript module block", () => {
    const it = test.extend("moduleBlockExpectBindingStates", () => {
      const source =
        "namespace Probe { if (true) { var expect = (value: boolean) => held; } expect(true); }";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ call, localBindings }) =>
          call.callee.type === "Identifier" && call.callee.name === "expect"
            ? [localBindings.has("expect")]
            : [],
      );
    });

    it("hoists var bindings inside a TypeScript module block", ({
      moduleBlockExpectBindingStates,
    }) => {
      expect(moduleBlockExpectBindingStates).toStrictEqual([true]);
    });
  });

  describe("a static block var beside a call in the containing function", () => {
    const it = test.extend("containingFunctionExpectBindingStates", () => {
      const source =
        "const run = () => { class Probe { static { var expect = true; } } expect(true); };";
      return scopedCallExpressionsIn(parseSync("source.test.ts", source).program).flatMap(
        ({ call, localBindings }) =>
          call.callee.type === "Identifier" && call.callee.name === "expect"
            ? [localBindings.has("expect")]
            : [],
      );
    });

    it("does not leak a static block var into its containing function", ({
      containingFunctionExpectBindingStates,
    }) => {
      expect(containingFunctionExpectBindingStates).toStrictEqual([false]);
    });
  });
});

layer(NodeServices.layer)("scopedCallExpressionsIn in a checked change", (it) => {
  describe("an imported assertion beside a binding of the same name in another lexical scope", () => {
    const otherLexicalScopeReport = Effect.gen(function* otherLexicalScopeReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\nconst helper = (expect: boolean) => expect;\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not let a binding in another lexical scope hide an imported assertion", () =>
      Effect.gen(function* program() {
        expect(yield* otherLexicalScopeReport).toStrictEqual({
          exitCode: 1,
          out: 'src/repository.test.ts:7 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("an imported assertion shadowed by a test callback parameter", () => {
    const shadowingParameterReport = Effect.gen(function* shadowingParameterReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", (expect) => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not resolve an imported assertion through a shadowing parameter", () =>
      Effect.gen(function* program() {
        expect(yield* shadowingParameterReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("an imported assertion shadowed by a class static block binding", () => {
    const staticBlockBindingReport = Effect.gen(function* staticBlockBindingReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  static {\n    const expect = (value: boolean) => ({ toBe: (expected: boolean) => held === expected });\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not resolve an imported assertion through a static block binding", () =>
      Effect.gen(function* program() {
        expect(yield* staticBlockBindingReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("an imported assertion shadowed by a TypeScript module binding", () => {
    const moduleBindingReport = Effect.gen(function* moduleBindingReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  const expect = (value: boolean) => ({ toBe: (expected: boolean) => held === expected });\n  expect(existsSync("src/legacy.ts")).toBe(false);\n}\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not resolve an imported assertion through a TypeScript module binding", () =>
      Effect.gen(function* program() {
        expect(yield* moduleBindingReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("a static block var beside an imported assertion in the enclosing test", () => {
    const staticBlockVarReport = Effect.gen(function* staticBlockVarReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  class Probe {\n    static {\n      var expect = true;\n    }\n  }\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not let a static block var hide an outer imported assertion", () =>
      Effect.gen(function* program() {
        expect(yield* staticBlockVarReport).toStrictEqual({
          exitCode: 1,
          out: 'src/repository.test.ts:10 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("an imported assertion shadowed by a constructor parameter property", () => {
    const parameterPropertyReport = Effect.gen(function* parameterPropertyReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync } from "node:fs";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private expect: (value: boolean) => { toBe(expected: boolean): boolean }) {\n    expect(existsSync("src/legacy.ts")).toBe(false);\n  }\n}\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not resolve an imported assertion through a parameter property", () =>
      Effect.gen(function* program() {
        expect(yield* parameterPropertyReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("a namespace import shadowed by a constructor parameter property", () => {
    const namespaceParameterPropertyReport = Effect.gen(
      function* namespaceParameterPropertyReport() {
        const repositoryRoot = yield* newRepository;
        yield* writeSource(
          repositoryRoot,
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        yield* commitSnapshot(repositoryRoot);
        yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
        yield* writeSource(
          repositoryRoot,
          "src/legacy-api.test.ts",
          'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nclass Probe {\n  constructor(private legacy: object) {\n    expect(legacy).not.toHaveProperty("legacyMode");\n  }\n}\n',
        );
        yield* commitSnapshot(repositoryRoot);
        return yield* lastCommitAnswer(repositoryRoot);
      },
    );

    it.effect("does not resolve a namespace import through a parameter property", () =>
      Effect.gen(function* program() {
        expect(yield* namespaceParameterPropertyReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("a namespace import shadowed by a local enum", () => {
    const localEnumReport = Effect.gen(function* localEnumReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  enum legacy { current }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not resolve a namespace import through a local enum", () =>
      Effect.gen(function* program() {
        expect(yield* localEnumReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("a namespace import shadowed by a local namespace", () => {
    const localNamespaceReport = Effect.gen(function* localNamespaceReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  export namespace legacy { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not resolve a namespace import through a local namespace", () =>
      Effect.gen(function* program() {
        expect(yield* localNamespaceReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("a namespace import shadowed by a qualified local namespace", () => {
    const qualifiedNamespaceReport = Effect.gen(function* qualifiedNamespaceReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  namespace legacy.inner { export const current = true; }\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not resolve a namespace import through a qualified local namespace", () =>
      Effect.gen(function* program() {
        expect(yield* qualifiedNamespaceReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("a namespace import beside a string-literal module declaration", () => {
    const stringLiteralModuleReport = Effect.gen(function* stringLiteralModuleReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\ndeclare module "legacy" {}\nexpect(legacy).not.toHaveProperty("legacyMode");\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("keeps resolving a namespace import past a string-literal module declaration", () =>
      Effect.gen(function* program() {
        expect(yield* stringLiteralModuleReport).toStrictEqual({
          exitCode: 1,
          out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("a namespace import shadowed by an import-equals binding", () => {
    const importEqualsReport = Effect.gen(function* importEqualsReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nnamespace Probe {\n  import legacy = Other.legacy;\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("does not resolve a namespace import through an import-equals binding", () =>
      Effect.gen(function* program() {
        expect(yield* importEqualsReport).toStrictEqual({ exitCode: 0, out: "", error: "" });
      }),
    );
  });

  describe("a namespace import beside a type-only declaration of the same name", () => {
    const typeOnlyDeclarationReport = Effect.gen(function* typeOnlyDeclarationReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        'import * as legacy from "./legacy.ts";\nimport { expect } from "vite-plus/test";\n\nfunction probe() {\n  interface legacy {}\n  expect(legacy).not.toHaveProperty("legacyMode");\n}\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("keeps resolving a namespace import past a type-only declaration", () =>
      Effect.gen(function* program() {
        expect(yield* typeOnlyDeclarationReport).toStrictEqual({
          exitCode: 1,
          out: 'src/legacy-api.test.ts:6 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });
});
