import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { runLintRuleAuthoring } from "./run-cli.ts";

const MISSING_INDEX = `packages/example/docs/lint/index.md A workspace that declares lint rules must not go without \`packages/example/docs/lint/index.md\`. Generate it with \`dont-review-it check --write\`.\n`;

const MISSING_DOC = `packages/example/docs/lint/no-thing--allow-it.md A rule must not go without its document. Seed it with \`dont-review-it check --write\`, then write the sections it leaves for you.\n`;

const MISSING_GUIDELINE_INDEX = `docs/lint-rules-by-guideline.md A repository whose rules name their grounds must not go without \`docs/lint-rules-by-guideline.md\`. Generate it with \`dont-review-it check --write\`.\n`;

const SEEDED_SECTIONS = [
  `packages/example/docs/lint/no-thing--allow-it.md A seeded section must not be left as it was written. Replace "State what this rule rejects, why the invariant behind it holds, and where the detection stops short.".`,
  `packages/example/docs/lint/no-thing--allow-it.md A seeded section must not be left as it was written. Replace "State the change that resolves a report.".`,
  `packages/example/docs/lint/no-thing--allow-it.md A seeded section must not be left as it was written. Replace "Name the ways a report can be silenced without being resolved.".`,
];

const NO_EXAMPLE = `packages/example/docs/lint/no-thing--allow-it.md A rule document must not go without an example. Mark the test cases to publish with \`documented: true\` in \`src/rules/no-thing--allow-it.test.ts\`.`;

const UNSPELLABLE_EXAMPLE = `packages/example/docs/lint/no-thing--allow-it.md A test case marked to publish must not build its code from values this reader cannot settle. "a case whose code is read at run time" in \`src/rules/no-thing--allow-it.test.ts\` resolves to no text. Write its code as a literal, or take the mark off it.`;

const SEEDED_SECTIONS_LEFT_AS_WRITTEN = [...SEEDED_SECTIONS, NO_EXAMPLE, ""].join("\n");

const DECLARED_RULE = `export const rule = {
  name: "no-thing--allow-it",
  meta: {
    docs: { description: "Disallow the thing", relatedGuidelines: ["docs/guidelines/writing.md"] },
    messages: { report: "No." },
  },
  create: () => ({}),
};
`;

const UNSPELLABLE_TEST = `testLintRule(rule, {
  valid: [{ name: "a case whose code is read at run time", documented: true, code: readCode() }],
  invalid: [],
});
`;

const JOINED_TEST = `const ANNOTATION = [":", "any"].join(" ");

testLintRule(rule, {
  valid: [
    {
      name: "a value that names no loose type passes",
      documented: true,
      code: \`const held\${ANNOTATION} = read();\`,
    },
  ],
  invalid: [],
});
`;

const TEST_FILE_PATH = "packages/example/src/rules/no-thing--allow-it.test.ts";

layer(NodeServices.layer)("runLintRuleAuthoring", (it) => {
  const declaringRepositoryFixture = Effect.gen(function* declaringRepository() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "lint-rule-authoring-cli-" });

    yield* filesystem.writeFileString(
      paths.join(root, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
    );
    yield* filesystem.writeFileString(
      paths.join(root, "package.json"),
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        name: "probe",
        normativeDocuments: { fileName: "AGENTS.md", directories: ["docs/guidelines"] },
      }),
    );
    yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
      recursive: true,
    });
    yield* filesystem.makeDirectory(paths.join(root, "docs/guidelines"), { recursive: true });
    yield* filesystem.writeFileString(
      paths.join(root, "docs/guidelines/writing.md"),
      "# writing\n",
    );
    yield* filesystem.writeFileString(
      paths.join(root, "packages/example/package.json"),
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        lintRules: ["src/rules"],
      }),
    );
    yield* filesystem.writeFileString(
      paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
      DECLARED_RULE,
    );
    return root;
  });

  describe("a repository that declares no lint rules", () => {
    const emptyRepositoryFixture = Effect.gen(function* emptyRepository() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({
        prefix: "lint-rule-authoring-cli-",
      });

      return root;
    });

    describe("a check of it", () => {
      const theRunFixture = Effect.gen(function* theRun() {
        const emptyRepository = yield* emptyRepositoryFixture;
        return yield* runLintRuleAuthoring({ repositoryRoot: emptyRepository, write: false });
      });

      it.effect("stays silent and exits zero because every index is fresh", () =>
        Effect.gen(function* program() {
          const theRun = yield* theRunFixture;
          expect(theRun).toStrictEqual({ exitCode: 0, out: "", error: "" });
        }),
      );
    });

    describe("a check of a repository root inside it that is no directory", () => {
      const theRunFixture = Effect.gen(function* theRun() {
        const paths = yield* Path.Path;
        const emptyRepository = yield* emptyRepositoryFixture;
        const missingRoot = paths.join(emptyRepository, "missing");
        return {
          missingRoot,
          ran: yield* runLintRuleAuthoring({ repositoryRoot: missingRoot, write: false }),
        };
      });

      it.effect("exits two instead of scanning nothing, naming the root back", () =>
        Effect.gen(function* program() {
          const paths = yield* Path.Path;
          const { missingRoot, ran } = yield* theRunFixture;
          expect(ran).toStrictEqual({
            exitCode: 2,
            out: "",
            error: `${paths.resolve(missingRoot)} is not a directory that can be scanned.\n`,
          });
        }),
      );
    });
  });

  describe("a repository that declares lint rules and carries no index", () => {
    describe("a check of it", () => {
      const theRunFixture = Effect.gen(function* theRun() {
        const declaringRepository = yield* declaringRepositoryFixture;
        return yield* runLintRuleAuthoring({ repositoryRoot: declaringRepository, write: false });
      });

      it.effect("reports every document it would have generated, and exits one", () =>
        Effect.gen(function* program() {
          const theRun = yield* theRunFixture;
          expect(theRun).toStrictEqual({
            exitCode: 1,
            out: `${MISSING_INDEX}${MISSING_DOC}${MISSING_GUIDELINE_INDEX}`,
            error: "",
          });
        }),
      );
    });

    describe("a check of it that is allowed to write", () => {
      const theRunFixture = Effect.gen(function* theRun() {
        const declaringRepository = yield* declaringRepositoryFixture;
        return yield* runLintRuleAuthoring({ repositoryRoot: declaringRepository, write: true });
      });

      it.effect(
        "regenerates the index, seeds the document, and asks for the sections it left",
        () =>
          Effect.gen(function* program() {
            const theRun = yield* theRunFixture;
            expect(theRun).toStrictEqual({
              exitCode: 1,
              out: SEEDED_SECTIONS_LEFT_AS_WRITTEN,
              error: "",
            });
          }),
      );
    });

    describe("a check of it that follows a writing check", () => {
      const theRunFixture = Effect.gen(function* theRun() {
        const declaringRepository = yield* declaringRepositoryFixture;
        yield* runLintRuleAuthoring({ repositoryRoot: declaringRepository, write: true });
        return yield* runLintRuleAuthoring({ repositoryRoot: declaringRepository, write: false });
      });

      it.effect("leaves nothing about the index and keeps asking for the seeded sections", () =>
        Effect.gen(function* program() {
          const theRun = yield* theRunFixture;
          expect(theRun).toStrictEqual({
            exitCode: 1,
            out: SEEDED_SECTIONS_LEFT_AS_WRITTEN,
            error: "",
          });
        }),
      );
    });
  });

  describe("a repository whose test marks a case it builds at run time", () => {
    const theRunFixture = Effect.gen(function* theRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const declaringRepository = yield* declaringRepositoryFixture;
      yield* filesystem.writeFileString(
        paths.join(declaringRepository, TEST_FILE_PATH),
        UNSPELLABLE_TEST,
      );
      return yield* runLintRuleAuthoring({ repositoryRoot: declaringRepository, write: true });
    });

    it.effect("names the marked case it could not spell out beside the missing example", () =>
      Effect.gen(function* program() {
        const theRun = yield* theRunFixture;
        expect(theRun).toStrictEqual({
          exitCode: 1,
          out: [...SEEDED_SECTIONS, NO_EXAMPLE, UNSPELLABLE_EXAMPLE, ""].join("\n"),
          error: "",
        });
      }),
    );
  });

  describe("a repository whose test marks a case built from a joined constant", () => {
    const theRunFixture = Effect.gen(function* theRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const declaringRepository = yield* declaringRepositoryFixture;
      yield* filesystem.writeFileString(
        paths.join(declaringRepository, TEST_FILE_PATH),
        JOINED_TEST,
      );
      return yield* runLintRuleAuthoring({ repositoryRoot: declaringRepository, write: true });
    });

    it.effect("publishes the case and asks only for the sections it seeded", () =>
      Effect.gen(function* program() {
        const theRun = yield* theRunFixture;
        expect(theRun).toStrictEqual({
          exitCode: 1,
          out: [...SEEDED_SECTIONS, ""].join("\n"),
          error: "",
        });
      }),
    );
  });
});
