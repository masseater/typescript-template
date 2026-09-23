import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { RETIRED_ANNOTATION_TAGS } from "./annotation.ts";
import { findEquivalentConcepts, inspectCanonicalValues } from "./verify.ts";

import type { CanonicalValue } from "./fingerprint.ts";

const TAG = "@canonical-values";

const ORDER_STATUS = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft"] as const;\n`;

const ORDER_STATUS_PAIR = `/** ${TAG} order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n`;

const ARTICLE_STATUS_PAIR = `/** ${TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "draft"] as const;\n`;

const ARCHIVED_ARTICLE_STATUS_PAIR = `/** ${TAG} article.status */\nexport const ARTICLE_STATUSES = ["published", "archived"] as const;\n`;

const BROKEN_ANNOTATION = `/** ${TAG} NOT VALID ID */\nexport const BROKEN_STATUSES = ["draft"] as const;\n`;

const RETIRED_ANNOTATION = `/** ${RETIRED_ANNOTATION_TAGS[0]} */\nexport const LEGACY_STATUSES = ["draft"];\n`;

const SUPPRESSED_LOCAL_VALUE_SET = `// oxlint-disable-next-line dont-review-it/no-local-finite-value-set--use-or-register-canonical-values\nexport const schema = z.enum(["draft", "published"]);\n`;

const SUPPRESSED_THROUGH_A_PLUGIN_ALIAS = `// oxlint-disable-next-line canonical-alias/no-local-finite-value-set--use-or-register-canonical-values\nexport const schema = z.enum(["draft", "published"]);\n`;

const SUPPRESSED_WITHOUT_NAMING_A_RULE = `// eslint-disable-next-line -- escape\nexport const schema = z.enum(["draft", "published"]);\n`;

const ORDER_STATUS_TWICE_ON_ONE_LINE = `/** ${TAG} order.status */ const A = ["draft"] as const; /** ${TAG} order.status */ const B = ["published"] as const;`;

const FIXTURE_STATUS = `/** ${TAG} fixture.status */\nexport const FIXTURE_STATUSES = ["draft"] as const;\n`;

const STORY_STATUS = `/** ${TAG} story.status */\nexport const STORY_STATUSES = ["draft"] as const;\n`;

const TEST_STATUS = `/** ${TAG} test.status */\nexport const TEST_STATUSES = ["draft"] as const;\n`;

const ANNOTATED_IF_STATEMENT = `/** ${TAG} fake.if */\nif (true) consume("draft");\n`;

const ANNOTATION_BEHIND_A_SECOND_COMMENT = `/** ${TAG} fake.intervening */\n/** display order */\nexport const VALUES = ["draft"] as const;\n`;

const ANNOTATION_INSIDE_A_FUNCTION_BODY = `export function load() {\n  /** ${TAG} fake.nested */\n  return "draft";\n}\nexport const BAIT = ["published"] as const;\n`;

const ANNOTATED_RE_EXPORT = `/** ${TAG} fake.re-export */\nexport { VALUES } from "./values.ts";\n`;

const ANNOTATED_CALL = `/** ${TAG} order.status */\nexport const VALUES = buildStatuses();\n`;

const UNTERMINATED_ANNOTATION = `/** ${TAG} order.status`;

const AMBIENT_ORDER_STATUS = `/** ${TAG} order.status */\nexport declare const ORDER_STATUSES: readonly ["draft", "published"];\n`;

const AGREEMENT_CASES: readonly {
  readonly form: string;
  readonly conceptId: string;
  readonly declaration: string;
  readonly declared: readonly CanonicalValue[] | null;
  readonly problemKind: string | null;
}[] = [
  {
    form: "an array",
    conceptId: "array.form",
    declaration: 'export const ARRAY_FORM = ["draft", "published"] as const;',
    declared: ["draft", "published"],
    problemKind: null,
  },
  {
    form: "an object",
    conceptId: "object.form",
    declaration: 'export const OBJECT_FORM = { Draft: "draft", Published: "published" } as const;',
    declared: ["Draft", "Published"],
    problemKind: null,
  },
  {
    form: "a type alias",
    conceptId: "type.form",
    declaration: 'export type TypeForm = "draft" | "published";',
    declared: null,
    problemKind: "invalid-declaration",
  },
  {
    form: "an enum",
    conceptId: "enum.form",
    declaration: 'export enum EnumForm {\n  Draft = "draft",\n  Published = "published",\n}',
    declared: null,
    problemKind: "invalid-declaration",
  },
  {
    form: "a call",
    conceptId: "call.form",
    declaration: "export const CALL_FORM = buildStatuses();",
    declared: null,
    problemKind: "vocabulary-without-values",
  },
];

layer(NodeServices.layer)("inspectCanonicalValues", (it) => {
  describe("a repository whose annotations are all well formed", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "order.ts"),
        ORDER_STATUS,
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("yields no problem", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([]);
      }),
    );
  });

  describe("a concept declared in two places", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "a.ts"), ORDER_STATUS);
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src", "b.ts"), ORDER_STATUS);
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("is rejected at the second declaration", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([
          {
            kind: "duplicate-concept",
            filePath: "src/b.ts",
            line: 1,
            conceptId: "order.status",
            declaredFilePath: "src/a.ts",
            declaredLine: 1,
          },
        ]);
      }),
    );
  });

  describe("a broken annotation inside a dot directory", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".config"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, ".config", "broken.ts"),
        BROKEN_ANNOTATION,
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("is reported", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([
          { kind: "unparsable-annotation", filePath: ".config/broken.ts", line: 1 },
        ]);
      }),
    );
  });

  describe("a concept declared in a dot directory and again in a source directory", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPaths = yield* Effect.gen(function* declarationPaths() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".config"), { recursive: true });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, ".config", "hidden.ts"),
          ORDER_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.ts"),
          ORDER_STATUS,
        );
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      });
      const problemSites = yield* Effect.gen(function* problemSites() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".config"), { recursive: true });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, ".config", "hidden.ts"),
          ORDER_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.ts"),
          ORDER_STATUS,
        );
        return inspectCanonicalValues({ repositoryRoot }).problems.map((problem) => [
          problem.kind,
          problem.filePath,
        ]);
      });
      return { declarationPaths, problemSites };
    });

    it.effect("leaves both duplicate owners out of the catalog", () =>
      Effect.gen(function* program() {
        const { declarationPaths } = yield* fixtures;
        expect(declarationPaths).toStrictEqual([]);
      }),
    );

    it.effect("collides at the second declaration", () =>
      Effect.gen(function* program() {
        const { problemSites } = yield* fixtures;
        expect(problemSites).toStrictEqual([["duplicate-concept", "src/order.ts"]]);
      }),
    );
  });

  describe("a concept declared in a test file beside the source it exercises", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPaths = yield* Effect.gen(function* declarationPaths() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.test.ts"),
          ORDER_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.ts"),
          ORDER_STATUS,
        );
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      });
      const problems = yield* Effect.gen(function* problems() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.test.ts"),
          ORDER_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.ts"),
          ORDER_STATUS,
        );
        const { problems } = inspectCanonicalValues({ repositoryRoot });
        return problems;
      });
      return { declarationPaths, problems };
    });

    it.effect("never becomes an owner", () =>
      Effect.gen(function* program() {
        const { declarationPaths } = yield* fixtures;
        expect(declarationPaths).toStrictEqual(["src/order.ts"]);
      }),
    );

    it.effect("is rejected as a declaration outside the owning scope", () =>
      Effect.gen(function* program() {
        const { problems } = yield* fixtures;
        expect(problems).toStrictEqual([
          {
            kind: "out-of-scope-declaration",
            filePath: "src/order.test.ts",
            line: 1,
            conceptId: "order.status",
          },
        ]);
      }),
    );
  });

  describe("a retired annotation tag", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "scripts"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "scripts", "legacy.mjs"),
        RETIRED_ANNOTATION,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "order.test.ts"),
        RETIRED_ANNOTATION,
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("is rejected wherever it sits, including a test file", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([
          {
            kind: "retired-annotation-tag",
            filePath: "scripts/legacy.mjs",
            line: 1,
            tag: RETIRED_ANNOTATION_TAGS[0],
          },
          {
            kind: "retired-annotation-tag",
            filePath: "src/order.test.ts",
            line: 1,
            tag: RETIRED_ANNOTATION_TAGS[0],
          },
        ]);
      }),
    );
  });

  describe("a suppressed canonical rule on a source carrying no annotation", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "consumer.ts"),
        SUPPRESSED_LOCAL_VALUE_SET,
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("is rejected without requiring an annotation", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([
          { kind: "canonical-rule-suppression", filePath: "src/consumer.ts", line: 1 },
        ]);
      }),
    );
  });

  describe("a canonical rule suppressed through a plugin alias", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "consumer.ts"),
        SUPPRESSED_THROUGH_A_PLUGIN_ALIAS,
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("remains rejected", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([
          { kind: "canonical-rule-suppression", filePath: "src/consumer.ts", line: 1 },
        ]);
      }),
    );
  });

  describe("a vendored source under node_modules", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "node_modules", "vendor"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "node_modules", "vendor", "index.ts"),
        ORDER_STATUS,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "order.ts"),
        ORDER_STATUS,
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("is outside the scan", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([]);
      }),
    );
  });

  describe("a build output directory", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "dist"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "dist", "order.ts"),
        ORDER_STATUS,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "order.ts"),
        ORDER_STATUS,
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("is outside the scan", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([]);
      }),
    );
  });

  describe("a directory symlinked to a target outside the repository", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const workspace = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

      const repositoryRoot = paths.join(workspace, "repository");
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(workspace, "outside", "vendor"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "order.ts"),
        ORDER_STATUS,
      );
      yield* filesystem.writeFileString(
        paths.join(workspace, "outside", "vendor", "status.ts"),
        ORDER_STATUS,
      );
      yield* filesystem.symlink(
        paths.join(workspace, "outside", "vendor"),
        paths.join(repositoryRoot, "linked"),
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("is a repository problem of its own", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([
          { kind: "unsafe-symbolic-link", line: 1, filePath: "linked" },
        ]);
      }),
    );
  });

  describe("a source symlinked to a build output inside the repository", () => {
    const fixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "dist"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "dist", "consumer.ts"),
        SUPPRESSED_WITHOUT_NAMING_A_RULE,
      );
      yield* filesystem.symlink(
        paths.join(repositoryRoot, "dist", "consumer.ts"),
        paths.join(repositoryRoot, "src", "consumer.ts"),
      );
      const { problems } = inspectCanonicalValues({ repositoryRoot });
      return problems;
    });

    it.effect("cannot hide the canonical rule suppression it points at", () =>
      Effect.gen(function* program() {
        const problems = yield* fixture;
        expect(problems).toStrictEqual([
          { kind: "canonical-rule-suppression", filePath: "src/consumer.ts", line: 1 },
        ]);
      }),
    );
  });

  describe("two declarations of one concept on one physical line", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPaths = yield* Effect.gen(function* declarationPaths() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "status.ts"),
          ORDER_STATUS_TWICE_ON_ONE_LINE,
        );
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      });
      const problems = yield* Effect.gen(function* problems() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "status.ts"),
          ORDER_STATUS_TWICE_ON_ONE_LINE,
        );
        const { problems } = inspectCanonicalValues({ repositoryRoot });
        return problems;
      });
      return { declarationPaths, problems };
    });

    it.effect("leaves neither of them in the catalog", () =>
      Effect.gen(function* program() {
        const { declarationPaths } = yield* fixtures;
        expect(declarationPaths).toStrictEqual([]);
      }),
    );

    it.effect("is rejected as a duplicate against its own line", () =>
      Effect.gen(function* program() {
        const { problems } = yield* fixtures;
        expect(problems).toStrictEqual([
          {
            kind: "duplicate-concept",
            filePath: "src/status.ts",
            line: 1,
            conceptId: "order.status",
            declaredFilePath: "src/status.ts",
            declaredLine: 1,
          },
        ]);
      }),
    );
  });

  describe("annotations in a fixture, a story, and a test file", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPaths = yield* Effect.gen(function* declarationPaths() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "fixtures"), {
          recursive: true,
        });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "fixtures", "status.ts"),
          FIXTURE_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "Order.stories.ts"),
          STORY_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.test.ts"),
          TEST_STATUS,
        );
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      });
      const problemSites = yield* Effect.gen(function* problemSites() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "fixtures"), {
          recursive: true,
        });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "fixtures", "status.ts"),
          FIXTURE_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "Order.stories.ts"),
          STORY_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.test.ts"),
          TEST_STATUS,
        );
        return inspectCanonicalValues({ repositoryRoot }).problems.map((problem) => [
          problem.kind,
          problem.filePath,
        ]);
      });
      return { declarationPaths, problemSites };
    });

    it.effect("never become owners", () =>
      Effect.gen(function* program() {
        const { declarationPaths } = yield* fixtures;
        expect(declarationPaths).toStrictEqual([]);
      }),
    );

    it.effect("are each rejected as a declaration outside the owning scope", () =>
      Effect.gen(function* program() {
        const { problemSites } = yield* fixtures;
        expect(problemSites).toStrictEqual([
          ["out-of-scope-declaration", "fixtures/status.ts"],
          ["out-of-scope-declaration", "src/Order.stories.ts"],
          ["out-of-scope-declaration", "src/order.test.ts"],
        ]);
      }),
    );
  });

  describe("annotations that name no adjacent module scope declaration", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPaths = yield* Effect.gen(function* declarationPaths() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "if.ts"),
          ANNOTATED_IF_STATEMENT,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "intervening.ts"),
          ANNOTATION_BEHIND_A_SECOND_COMMENT,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "nested.ts"),
          ANNOTATION_INSIDE_A_FUNCTION_BODY,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "re-export.ts"),
          ANNOTATED_RE_EXPORT,
        );
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      });
      const problemReasons = yield* Effect.gen(function* problemReasons() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "if.ts"),
          ANNOTATED_IF_STATEMENT,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "intervening.ts"),
          ANNOTATION_BEHIND_A_SECOND_COMMENT,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "nested.ts"),
          ANNOTATION_INSIDE_A_FUNCTION_BODY,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "re-export.ts"),
          ANNOTATED_RE_EXPORT,
        );
        return inspectCanonicalValues({ repositoryRoot }).problems.map((problem) => [
          problem.kind,
          problem.filePath,
          problem.kind === "invalid-declaration" ? problem.reason : null,
        ]);
      });
      return { declarationPaths, problemReasons };
    });

    it.effect("leave the catalog empty", () =>
      Effect.gen(function* program() {
        const { declarationPaths } = yield* fixtures;
        expect(declarationPaths).toStrictEqual([]);
      }),
    );

    it.effect("are each rejected with the reason the declaration is invalid", () =>
      Effect.gen(function* program() {
        const { problemReasons } = yield* fixtures;
        expect(problemReasons).toStrictEqual([
          ["invalid-declaration", "src/if.ts", "variable-statement-required"],
          ["invalid-declaration", "src/intervening.ts", "adjacent-declaration-required"],
          ["invalid-declaration", "src/nested.ts", "module-scope-required"],
          ["invalid-declaration", "src/re-export.ts", "variable-statement-required"],
        ]);
      }),
    );
  });

  describe("an annotation on a value domain that resolves to nothing supported", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPaths = yield* Effect.gen(function* declarationPaths() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "status.ts"),
          ANNOTATED_CALL,
        );
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      });
      const problems = yield* Effect.gen(function* problems() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "status.ts"),
          ANNOTATED_CALL,
        );
        const { problems } = inspectCanonicalValues({ repositoryRoot });
        return problems;
      });
      return { declarationPaths, problems };
    });

    it.effect("earns no catalog entry", () =>
      Effect.gen(function* program() {
        const { declarationPaths } = yield* fixtures;
        expect(declarationPaths).toStrictEqual([]);
      }),
    );

    it.effect("is rejected as a vocabulary without values", () =>
      Effect.gen(function* program() {
        const { problems } = yield* fixtures;
        expect(problems).toStrictEqual([
          {
            kind: "vocabulary-without-values",
            filePath: "src/status.ts",
            line: 1,
            conceptId: "order.status",
          },
        ]);
      }),
    );
  });

  describe("an annotated comment that is never terminated", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPaths = yield* Effect.gen(function* declarationPaths() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "status.ts"),
          UNTERMINATED_ANNOTATION,
        );
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      });
      const problems = yield* Effect.gen(function* problems() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "status.ts"),
          UNTERMINATED_ANNOTATION,
        );
        const { problems } = inspectCanonicalValues({ repositoryRoot });
        return problems;
      });
      return { declarationPaths, problems };
    });

    it.effect("earns no catalog entry", () =>
      Effect.gen(function* program() {
        const { declarationPaths } = yield* fixtures;
        expect(declarationPaths).toStrictEqual([]);
      }),
    );

    it.effect("is rejected as an unparsable source", () =>
      Effect.gen(function* program() {
        const { problems } = yield* fixtures;
        expect(problems).toStrictEqual([
          { kind: "unparsable-source", filePath: "src/status.ts", line: 1 },
        ]);
      }),
    );
  });

  describe("an annotation on an ambient TypeScript declaration", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const declarationPaths = yield* Effect.gen(function* declarationPaths() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.d.ts"),
          AMBIENT_ORDER_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.ts"),
          AMBIENT_ORDER_STATUS,
        );
        return inspectCanonicalValues({ repositoryRoot }).catalog.entries.map(
          (declaredConcept) => declaredConcept.declarationPath,
        );
      });
      const problemReasons = yield* Effect.gen(function* problemReasons() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "canonical-values-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.d.ts"),
          AMBIENT_ORDER_STATUS,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "src", "order.ts"),
          AMBIENT_ORDER_STATUS,
        );
        return inspectCanonicalValues({ repositoryRoot }).problems.map((problem) => [
          problem.kind,
          problem.filePath,
          problem.kind === "invalid-declaration" ? problem.reason : null,
        ]);
      });
      return { declarationPaths, problemReasons };
    });

    it.effect("supplies no runtime owner", () =>
      Effect.gen(function* program() {
        const { declarationPaths } = yield* fixtures;
        expect(declarationPaths).toStrictEqual([]);
      }),
    );

    it.effect("is rejected for want of a runtime initializer", () =>
      Effect.gen(function* program() {
        const { problemReasons } = yield* fixtures;
        expect(problemReasons).toStrictEqual([
          ["invalid-declaration", "src/order.d.ts", "runtime-initializer-required"],
          ["invalid-declaration", "src/order.ts", "runtime-initializer-required"],
        ]);
      }),
    );
  });

  describe("every declaration form, declared once", () => {
    const fixture = Effect.gen(function* agreement() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const workspace = yield* filesystem.makeTempDirectoryScoped({ prefix: "canonical-values-" });

      return yield* Effect.forEach(AGREEMENT_CASES, ({ conceptId, declaration, form }) =>
        Effect.gen(function* agreementOfCase() {
          const repositoryRoot = paths.join(workspace, conceptId);
          yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(repositoryRoot, "src", "owner.ts"),
            `/** ${TAG} ${conceptId} */\n${declaration}\n`,
          );
          const inspection = inspectCanonicalValues({ repositoryRoot });
          return {
            form,
            catalogued: inspection.catalog.entries.map((declaredConcept) => [
              declaredConcept.declarationPath,
              declaredConcept.conceptId,
              declaredConcept.values,
            ]),
            verified: inspection.problems.map((problem) => [problem.kind, problem.filePath]),
          };
        }),
      );
    });

    it.effect("is read the same way by the catalog and by the verification", () =>
      Effect.gen(function* program() {
        const agreement = yield* fixture;
        expect(agreement).toStrictEqual(
          AGREEMENT_CASES.map(({ conceptId, declared, form, problemKind }) =>
            problemKind === null
              ? {
                  form,
                  catalogued: [["src/owner.ts", conceptId, declared]],
                  verified: [],
                }
              : {
                  form,
                  catalogued: [],
                  verified: [[problemKind, "src/owner.ts"]],
                },
          ),
        );
      }),
    );
  });
});

layer(NodeServices.layer)("findEquivalentConcepts", (it) => {
  describe("two concepts that declare the same value set", () => {
    const fixture = Effect.gen(function* conceptIdGroups() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "article.ts"),
        ARTICLE_STATUS_PAIR,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "order.ts"),
        ORDER_STATUS_PAIR,
      );
      return findEquivalentConcepts(inspectCanonicalValues({ repositoryRoot }).catalog.entries).map(
        (equivalenceGroup) => equivalenceGroup.map((declaredConcept) => declaredConcept.conceptId),
      );
    });

    it.effect("are reported as one group", () =>
      Effect.gen(function* program() {
        const conceptIdGroups = yield* fixture;
        expect(conceptIdGroups).toStrictEqual([["article.status", "order.status"]]);
      }),
    );
  });

  describe("concepts that declare different value sets", () => {
    const fixture = Effect.gen(function* equivalenceGroups() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "article.ts"),
        ARCHIVED_ARTICLE_STATUS_PAIR,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "order.ts"),
        ORDER_STATUS_PAIR,
      );
      return findEquivalentConcepts(inspectCanonicalValues({ repositoryRoot }).catalog.entries);
    });

    it.effect("form no group", () =>
      Effect.gen(function* program() {
        const equivalenceGroups = yield* fixture;
        expect(equivalenceGroups).toStrictEqual([]);
      }),
    );
  });

  describe("two concepts that each declare no values yet", () => {
    const fixture = Effect.gen(function* equivalenceGroups() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "canonical-values-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "article.ts"),
        `/** ${TAG} article.flag */\nexport const ARTICLE_FLAGS = [] as const;\n`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src", "order.ts"),
        `/** ${TAG} order.flag */\nexport const ORDER_FLAGS = [] as const;\n`,
      );
      return findEquivalentConcepts(inspectCanonicalValues({ repositoryRoot }).catalog.entries);
    });

    it.effect("form no group", () =>
      Effect.gen(function* program() {
        const equivalenceGroups = yield* fixture;
        expect(equivalenceGroups).toStrictEqual([]);
      }),
    );
  });
});
