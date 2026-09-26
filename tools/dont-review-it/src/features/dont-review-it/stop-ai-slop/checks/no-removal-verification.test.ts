import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Config, Effect, FileSystem, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { stopAiSlop } from "../run-cli.ts";

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
        GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
        GIT_AUTHOR_NAME: "Stop AI Slop",
        GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
        GIT_COMMITTER_NAME: "Stop AI Slop",
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
    prefix: "no-removal-verification-",
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

layer(NodeServices.layer)("no-removal-verification", (it) => {
  describe("a head that adds a test file for each source file it deletes", () => {
    const deletedSourceTestReport = Effect.gen(function* deletedSourceTestReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/zeta.ts", "export const zeta = true;\n");
      yield* writeSource(repositoryRoot, "src/alpha.ts", "export const alpha = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/zeta.test.ts", "");
      yield* writeSource(repositoryRoot, "src/alpha.test.ts", "");
      yield* removeSource(repositoryRoot, "src/zeta.ts");
      yield* removeSource(repositoryRoot, "src/alpha.ts");
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("names every test file that stands for a deleted source file", () =>
      Effect.gen(function* program() {
        expect(yield* deletedSourceTestReport).toStrictEqual({
          exitCode: 1,
          out: 'src/alpha.test.ts:1 no-removal-verification: Do not add a test for deleted file "src/alpha.ts"; remove the test or restore the file.\nsrc/zeta.test.ts:1 no-removal-verification: Do not add a test for deleted file "src/zeta.ts"; remove the test or restore the file.\n',
          error: "",
        });
      }),
    );
  });

  describe("a head that adds an assertion that a file it deleted does not exist", () => {
    const deletedFileAssertionReport = Effect.gen(function* deletedFileAssertionReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
      );
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("names the assertion and the file it says is gone", () =>
      Effect.gen(function* program() {
        expect(yield* deletedFileAssertionReport).toStrictEqual({
          exitCode: 1,
          out: 'src/repository.test.ts:5 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("a file absence assertion written through aliased imports", () => {
    const aliasedImportAssertionReport = Effect.gen(function* aliasedImportAssertionReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync as pathExists } from "node:fs";\nimport { expect as verify, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  verify(pathExists("src/legacy.ts")).toBe(false);\n});\n',
      );
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("resolves both aliases and names the deleted file", () =>
      Effect.gen(function* program() {
        expect(yield* aliasedImportAssertionReport).toStrictEqual({
          exitCode: 1,
          out: 'src/repository.test.ts:5 no-removal-verification: Do not assert that deleted file "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("a head that adds assertions that named exports it removed are absent", () => {
    const removedExportAssertionReport = Effect.gen(function* removedExportAssertionReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\nexport const secondLegacyMode = true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy modes are gone", () => {\n  expect(legacy).not.toHaveProperty("secondLegacyMode");\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("names every removed export the assertions speak about", () =>
      Effect.gen(function* program() {
        expect(yield* removedExportAssertionReport).toStrictEqual({
          exitCode: 1,
          out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "secondLegacyMode" from "src/legacy.ts" remains absent; remove the assertion.\nsrc/legacy-api.test.ts:6 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("a head that adds an assertion for a named re-export it removed", () => {
    const removedReExportAssertionReport = Effect.gen(function* removedReExportAssertionReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/public.ts",
        'export { current, legacyMode } from "./implementation.ts";\n',
      );
      yield* writeSource(
        repositoryRoot,
        "src/implementation.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(
        repositoryRoot,
        "src/public.ts",
        'export { current } from "./implementation.ts";\n',
      );
      yield* writeSource(
        repositoryRoot,
        "src/public-api.test.ts",
        'import * as publicApi from "./public.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(publicApi).not.toHaveProperty("legacyMode");\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("names the re-exporting module the assertion speaks about", () =>
      Effect.gen(function* program() {
        expect(yield* removedReExportAssertionReport).toStrictEqual({
          exitCode: 1,
          out: 'src/public-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/public.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("a head that adds an undefined assertion for a named export it removed", () => {
    const undefinedExportAssertionReport = Effect.gen(function* undefinedExportAssertionReport() {
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
        'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy.legacyMode).toBeUndefined();\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("reads the undefined assertion as the same claim", () =>
      Effect.gen(function* program() {
        expect(yield* undefinedExportAssertionReport).toStrictEqual({
          exitCode: 1,
          out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("a head that adds one more assertion beside an assertion carrying the same locator", () => {
    const additionalLocatorAssertionReport = Effect.gen(
      function* additionalLocatorAssertionReport() {
        const repositoryRoot = yield* newRepository;
        const assertionImports =
          'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n';
        const skippedGuard =
          'test.skip("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
        yield* writeSource(
          repositoryRoot,
          "src/legacy.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        yield* writeSource(
          repositoryRoot,
          "src/legacy-api.test.ts",
          `${assertionImports}\n${skippedGuard}`,
        );
        yield* commitSnapshot(repositoryRoot);
        yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
        yield* writeSource(
          repositoryRoot,
          "src/legacy-api.test.ts",
          `${assertionImports}\ntest("legacy mode is gone", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n\n${skippedGuard}`,
        );
        yield* commitSnapshot(repositoryRoot);
        return yield* lastCommitAnswer(repositoryRoot);
      },
    );

    it.effect("names the assertion the head added", () =>
      Effect.gen(function* program() {
        expect(yield* additionalLocatorAssertionReport).toStrictEqual({
          exitCode: 1,
          out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("an assertion whose import the head moved onto the module it removed the export from", () => {
    const retargetedImportAssertionReport = Effect.gen(function* retargetedImportAssertionReport() {
      const repositoryRoot = yield* newRepository;
      const guardingSpec =
        'import * as legacy from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n';
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* writeSource(repositoryRoot, "src/other.ts", "export const current = true;\n");
      yield* writeSource(repositoryRoot, "src/legacy-api.test.ts", guardingSpec);
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        guardingSpec.replace("./other.ts", "./legacy.ts"),
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("names the module the import now points at", () =>
      Effect.gen(function* program() {
        expect(yield* retargetedImportAssertionReport).toStrictEqual({
          exitCode: 1,
          out: 'src/legacy-api.test.ts:5 no-removal-verification: Do not assert that removed export "legacyMode" from "src/legacy.ts" remains absent; remove the assertion.\n',
          error: "",
        });
      }),
    );
  });

  describe("a head that deletes a file without adding any absence check", () => {
    const deletionWithoutAssertionReport = Effect.gen(function* deletionWithoutAssertionReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("lets the deletion through", () =>
      Effect.gen(function* program() {
        expect(yield* deletionWithoutAssertionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("an absence check the head adds without deleting anything it names", () => {
    const assertionWithoutDeletionReport = Effect.gen(function* assertionWithoutDeletionReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(repositoryRoot, "src/current.ts", "export const current = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("lets the assertion through", () =>
      Effect.gen(function* program() {
        expect(yield* assertionWithoutDeletionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("an assertion that a deleted file still exists", () => {
    const positiveExistenceAssertionReport = Effect.gen(
      function* positiveExistenceAssertionReport() {
        const repositoryRoot = yield* newRepository;
        yield* writeSource(repositoryRoot, "src/legacy.ts", "export const legacy = true;\n");
        yield* commitSnapshot(repositoryRoot);
        yield* writeSource(
          repositoryRoot,
          "src/repository.test.ts",
          'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy exists", () => {\n  expect(existsSync("src/legacy.ts")).toBe(true);\n});\n',
        );
        yield* removeSource(repositoryRoot, "src/legacy.ts");
        yield* commitSnapshot(repositoryRoot);
        return yield* lastCommitAnswer(repositoryRoot);
      },
    );

    it.effect("lets the positive assertion through", () =>
      Effect.gen(function* program() {
        expect(yield* positiveExistenceAssertionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("an absence assertion the base already carried", () => {
    const existingAbsenceAssertionReport = Effect.gen(function* existingAbsenceAssertionReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport const legacyMode = true;\n",
      );
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is absent", () => {\n  expect(legacy).not.toHaveProperty("legacyMode");\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("lets the assertion the head left alone through", () =>
      Effect.gen(function* program() {
        expect(yield* existingAbsenceAssertionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("an assertion naming an export of a module the head did not touch", () => {
    const otherModuleExportAssertionReport = Effect.gen(
      function* otherModuleExportAssertionReport() {
        const repositoryRoot = yield* newRepository;
        yield* writeSource(
          repositoryRoot,
          "src/removed-from.ts",
          "export const current = true;\nexport const legacyMode = true;\n",
        );
        yield* writeSource(repositoryRoot, "src/other.ts", "export const legacyMode = true;\n");
        yield* commitSnapshot(repositoryRoot);
        yield* writeSource(repositoryRoot, "src/removed-from.ts", "export const current = true;\n");
        yield* writeSource(
          repositoryRoot,
          "src/other-api.test.ts",
          'import * as other from "./other.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("other module", () => {\n  expect(other).not.toHaveProperty("legacyMode");\n});\n',
        );
        yield* commitSnapshot(repositoryRoot);
        return yield* lastCommitAnswer(repositoryRoot);
      },
    );

    it.effect("keeps the two modules apart", () =>
      Effect.gen(function* program() {
        expect(yield* otherModuleExportAssertionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("a module path and an export name that both carry the locator separator", () => {
    const locatorSeparatorAssertionReport = Effect.gen(function* locatorSeparatorAssertionReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/a.ts",
        'const value = true;\nexport { value as "x.ts#foo" };\n',
      );
      yield* writeSource(repositoryRoot, "src/a.ts#x.ts", "export const foo = true;\n");
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/a.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/collision.test.ts",
        'import * as other from "./a.ts#x.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("other module", () => {\n  expect(other).not.toHaveProperty("foo");\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("keeps the two locators apart", () =>
      Effect.gen(function* program() {
        expect(yield* locatorSeparatorAssertionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("assertions naming a type export and a default export the head dropped", () => {
    const nonValueExportAssertionReport = Effect.gen(function* nonValueExportAssertionReport() {
      const repositoryRoot = yield* newRepository;
      yield* writeSource(
        repositoryRoot,
        "src/legacy.ts",
        "export const current = true;\nexport type Legacy = string;\nexport default true;\n",
      );
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/legacy.ts", "export const current = true;\n");
      yield* writeSource(
        repositoryRoot,
        "src/legacy-api.test.ts",
        'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("non-value exports", () => {\n  expect(legacy).not.toHaveProperty("Legacy");\n  expect(legacy).not.toHaveProperty("default");\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("counts neither of them as a removed value export", () =>
      Effect.gen(function* program() {
        expect(yield* nonValueExportAssertionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("assertions naming a default alias and a default re-export the head dropped", () => {
    const defaultExportAliasAssertionReport = Effect.gen(
      function* defaultExportAliasAssertionReport() {
        const repositoryRoot = yield* newRepository;
        yield* writeSource(
          repositoryRoot,
          "src/alias.ts",
          'const value = true;\nexport { value as "default" };\n',
        );
        yield* writeSource(
          repositoryRoot,
          "src/re-export.ts",
          'export { value as default } from "./implementation.ts";\n',
        );
        yield* writeSource(repositoryRoot, "src/implementation.ts", "export const value = true;\n");
        yield* commitSnapshot(repositoryRoot);
        yield* writeSource(repositoryRoot, "src/alias.ts", "export const current = true;\n");
        yield* writeSource(repositoryRoot, "src/re-export.ts", "export const current = true;\n");
        yield* writeSource(
          repositoryRoot,
          "src/default-api.test.ts",
          'import * as alias from "./alias.ts";\nimport * as reExport from "./re-export.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("default exports", () => {\n  expect(alias).not.toHaveProperty("default");\n  expect(reExport).not.toHaveProperty("default");\n});\n',
        );
        yield* commitSnapshot(repositoryRoot);
        return yield* lastCommitAnswer(repositoryRoot);
      },
    );

    it.effect("counts neither of them as a removed named export", () =>
      Effect.gen(function* program() {
        expect(yield* defaultExportAliasAssertionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("an absence assertion naming the old path of a file the head renamed", () => {
    const renamedFileAssertionReport = Effect.gen(function* renamedFileAssertionReport() {
      const repositoryRoot = yield* newRepository;
      const renamedSource = "export const legacy = true;\n";
      yield* writeSource(repositoryRoot, "src/legacy.ts", renamedSource);
      yield* commitSnapshot(repositoryRoot);
      yield* writeSource(repositoryRoot, "src/current.ts", renamedSource);
      yield* writeSource(
        repositoryRoot,
        "src/repository.test.ts",
        'import { existsSync } from "node:fs";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy path is gone", () => {\n  expect(existsSync("src/legacy.ts")).toBe(false);\n});\n',
      );
      yield* removeSource(repositoryRoot, "src/legacy.ts");
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("reads the rename as a move rather than a deletion", () =>
      Effect.gen(function* program() {
        expect(yield* renamedFileAssertionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });

  describe("an assertion reaching the removed export through a computed property", () => {
    const computedPropertyAssertionReport = Effect.gen(function* computedPropertyAssertionReport() {
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
        'import * as legacy from "./legacy.ts";\nimport { expect, test } from "vite-plus/test";\n\ntest("legacy mode is gone", () => {\n  expect(legacy["legacyMode"]).toBeUndefined();\n});\n',
      );
      yield* commitSnapshot(repositoryRoot);
      return yield* lastCommitAnswer(repositoryRoot);
    });

    it.effect("reads only the static member as the claim", () =>
      Effect.gen(function* program() {
        expect(yield* computedPropertyAssertionReport).toStrictEqual({
          exitCode: 0,
          out: "",
          error: "",
        });
      }),
    );
  });
});
