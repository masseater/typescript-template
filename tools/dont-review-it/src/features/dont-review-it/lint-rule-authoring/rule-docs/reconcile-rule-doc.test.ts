import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect } from "vite-plus/test";

import { lintRuleDocProblems } from "./reconcile-rule-doc.ts";
import { FRONTMATTER_DESCRIPTION_PATTERN, beginMarkerOf, endMarkerOf } from "./render-rule-doc.ts";
import { PLACEHOLDER_TOKENS } from "./scaffold-rule-doc.ts";

const RULE_SOURCE = `export const rule = {
  name: "no-thing--allow-it",
  meta: { docs: { description: "Disallow the thing" }, messages: { report: "No." } },
  create: () => ({}),
};
`;

const RULE_TEST = `testLintRule(rule, {
  valid: [{ name: "a value the rule leaves alone", documented: true, code: "export const shipped = true;" }],
  invalid: [],
});
`;

const DOC_PATH = "packages/example/docs/lint/no-thing--allow-it.md";

const WRITTEN_PROSE = "What this rule holds, and the move that clears a report.";

layer(NodeServices.layer)("lintRuleDocProblems", (it) => {
  const repositoryFixture = Effect.gen(function* repository() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-doc-" });

    yield* filesystem.writeFileString(
      paths.join(root, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
    );
    yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
      recursive: true,
    });
    yield* filesystem.writeFileString(
      paths.join(root, "packages/example/package.json"),
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        lintRules: ["src/rules"],
      }),
    );
    yield* filesystem.writeFileString(
      paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
      RULE_SOURCE,
    );
    yield* filesystem.writeFileString(
      paths.join(root, "packages/example/src/rules/no-thing--allow-it.test.ts"),
      RULE_TEST,
    );
    yield* lintRuleDocProblems({ repositoryRoot: root, write: true });
    const seeded = yield* filesystem.readFileString(paths.join(root, DOC_PATH));
    yield* filesystem.writeFileString(
      paths.join(root, DOC_PATH),
      PLACEHOLDER_TOKENS.reduce((carried, token) => carried.replace(token, WRITTEN_PROSE), seeded),
    );
    return root;
  });

  describe("a document whose sections are written and whose regions are fresh", () => {
    const reportFixture = Effect.gen(function* report() {
      const repository = yield* repositoryFixture;
      return yield* lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it.effect("asks for nothing", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a document that lost a required heading", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repository = yield* repositoryFixture;
      const written = yield* filesystem.readFileString(paths.join(repository, DOC_PATH));
      yield* filesystem.writeFileString(
        paths.join(repository, DOC_PATH),
        written.replace("## Fix\n", ""),
      );
      return yield* lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it.effect("names the heading it went without", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: DOC_PATH, message: "A rule document must not go without `## Fix`." }],
          scanned: 1,
        });
      }),
    );
  });

  describe("a document that lost a generated region", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repository = yield* repositoryFixture;
      const written = yield* filesystem.readFileString(paths.join(repository, DOC_PATH));
      yield* filesystem.writeFileString(
        paths.join(repository, DOC_PATH),
        written.replace(beginMarkerOf("examples"), ""),
      );
      return yield* lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it.effect("names the region and sends the reader back to the seed", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: DOC_PATH,
              message:
                "A rule document must not lose its `examples` region. Delete the file and seed it again with `dont-review-it regenerate`.",
            },
          ],
          scanned: 1,
        });
      }),
    );
  });

  describe("a document that lost the description of its frontmatter", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repository = yield* repositoryFixture;
      const written = yield* filesystem.readFileString(paths.join(repository, DOC_PATH));
      yield* filesystem.writeFileString(
        paths.join(repository, DOC_PATH),
        written.replace(FRONTMATTER_DESCRIPTION_PATTERN, "title: a rule"),
      );
      return yield* lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it.effect("names the frontmatter description as the region it went without", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: DOC_PATH,
              message:
                "A rule document must not lose its `frontmatter description` region. Delete the file and seed it again with `dont-review-it regenerate`.",
            },
          ],
          scanned: 1,
        });
      }),
    );
  });

  describe("a document whose frontmatter description fell behind the rule", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repository = yield* repositoryFixture;
      const written = yield* filesystem.readFileString(paths.join(repository, DOC_PATH));
      yield* filesystem.writeFileString(
        paths.join(repository, DOC_PATH),
        written.replace(FRONTMATTER_DESCRIPTION_PATTERN, 'description: "what it once disallowed"'),
      );
      return yield* lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it.effect("asks for it to be regenerated", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: DOC_PATH,
              message:
                "The `frontmatter description` region must not fall behind the rule. Regenerate it with `dont-review-it regenerate`.",
            },
          ],
          scanned: 1,
        });
      }),
    );
  });

  describe("a document whose generated region fell behind the rule", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repository = yield* repositoryFixture;
      const written = yield* filesystem.readFileString(paths.join(repository, DOC_PATH));
      yield* filesystem.writeFileString(
        paths.join(repository, DOC_PATH),
        written.replace(
          endMarkerOf("messages"),
          `what stood here before\n\n${endMarkerOf("messages")}`,
        ),
      );
      return yield* lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it.effect("asks for that region to be regenerated", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: DOC_PATH,
              message:
                "The `messages` region must not fall behind the rule. Regenerate it with `dont-review-it regenerate`.",
            },
          ],
          scanned: 1,
        });
      }),
    );
  });

  describe("a check allowed to write over a region that fell behind", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repository = yield* repositoryFixture;
      const written = yield* filesystem.readFileString(paths.join(repository, DOC_PATH));
      yield* filesystem.writeFileString(
        paths.join(repository, DOC_PATH),
        written.replace(
          endMarkerOf("messages"),
          `what stood here before\n\n${endMarkerOf("messages")}`,
        ),
      );
      yield* lintRuleDocProblems({ repositoryRoot: repository, write: true });
      return yield* lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it.effect("leaves the document with nothing left to ask for", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a rule that declares no description", () => {
    const repositoryFixture = Effect.gen(function* repository() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-doc-" });

      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n",
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          lintRules: ["src/rules"],
        }),
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE.replace("Disallow the thing", ""),
      );
      return root;
    });

    const reportFixture = Effect.gen(function* report() {
      const repository = yield* repositoryFixture;
      return yield* lintRuleDocProblems({ repositoryRoot: repository, write: false });
    });

    it.effect("reports the rule itself rather than the document built from it", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "src/rules/no-thing--allow-it.ts",
              message:
                "A rule must not go without `meta.docs.description`; the document is built from it. Declare it on the rule.",
            },
          ],
          scanned: 1,
        });
      }),
    );
  });
});
