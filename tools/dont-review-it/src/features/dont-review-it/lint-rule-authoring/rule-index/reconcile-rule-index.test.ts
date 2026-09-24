import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { formatLintRuleProblem } from "../lint-rule-problem.ts";
import { lintRuleIndexProblems } from "./reconcile-rule-index.ts";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

const DECLARING_MANIFEST = JSON.stringify({ name: "example", lintRules: ["src/rules"] });

const INDEX_PATH = "packages/example/docs/lint/index.md";

const RULE_SOURCE = `export const rule = {
  name: "no-thing--allow-it",
  meta: { docs: { description: "Disallow the thing" }, messages: { report: "No." } },
  create: () => ({}),
};
`;

const MISSING_INDEX = `A workspace that declares lint rules must not go without \`${INDEX_PATH}\`. Generate it with \`dont-review-it check --write\`.`;

const MISSING_MARKERS = `\`${INDEX_PATH}\` must not lose its generated region. Put \`<!-- BEGIN GENERATED lint-rules -->\` and \`<!-- END GENERATED lint-rules -->\` back, or delete the file and regenerate it with \`dont-review-it check --write\`.`;

const STALE_INDEX = `\`${INDEX_PATH}\` must not fall behind the rule implementations. Regenerate it with \`dont-review-it check --write\`.`;

const DUPLICATED_RULE_NAME = `Two rules in \`packages/example\` must not share the name \`no-thing--allow-it\`; they claim the same document. Rename one of them.`;

const STRAY_RULE_SOURCE = `export const rule = {
  name: "no-stray--allow-it",
  meta: { docs: { description: "Disallow straying" }, messages: { report: "No." } },
  create: () => ({}),
};
`;

const STRAY_RULE_PATH = "packages/example/src/rules/no-stray--allow-it.ts";

const UNBUNDLED_SHIPPED_RULE = `A rule the preset carries must not sit outside a bundle directory once \`packages/example\` declares bundles. Move \`no-stray--allow-it\` under the directory of the bundle that carries it, or declare \`shipped: false\` on it.`;

const ABSENT_RULE_DIRECTORY =
  "A workspace must not declare a rule directory that is not there, because the index then lists no rule from it and every rule check passes with nothing read. Create `packages/example/src/rules` or remove it from `lintRules`.";

const HANDWRITTEN_INDEX = "# A hand written index\n\nProse and nothing else.\n";

const STALE_REGION_INDEX = `# An index\n\nFront matter prose.\n\n<!-- BEGIN GENERATED lint-rules -->\n\nA stale table\n\n<!-- END GENERATED lint-rules -->\n\nTrailing prose.\n`;

layer(NodeServices.layer)("lintRuleIndexProblems", (it) => {
  describe("a repository without declaring workspaces", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("has nothing to reconcile", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 0 });
      }),
    );
  });

  describe("an index that is missing while the check only reads", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("is reported against the path it should have been written to", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: INDEX_PATH, message: MISSING_INDEX }],
          scanned: 1,
        });
      }),
    );
  });

  describe("an index that is missing while the check may write", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
    });

    it.effect("leaves nothing to report", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("the file a scaffolding run leaves behind", () => {
    const indexTextFixture = Effect.gen(function* indexText() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return yield* filesystem.readFileString(paths.join(root, INDEX_PATH));
    });

    it.effect("carries the generated region and the rule", () =>
      Effect.gen(function* program() {
        const indexText = yield* indexTextFixture;
        expect(indexText).toMatchInlineSnapshot(`
        "# Lint rule index

        Every lint rule this workspace implements. Generated from the rule sources; refresh it with \`dont-review-it check --write\` rather than editing it.

        <!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->
        "
      `);
      }),
    );
  });

  describe("the check that follows a scaffolding run", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("stays silent", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("an index without the generated region while the check only reads", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, INDEX_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, INDEX_PATH), HANDWRITTEN_INDEX);
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("is reported", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: INDEX_PATH, message: MISSING_MARKERS }],
          scanned: 1,
        });
      }),
    );
  });

  describe("an index without the generated region while the check may write", () => {
    const indexTextFixture = Effect.gen(function* indexText() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, INDEX_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, INDEX_PATH), HANDWRITTEN_INDEX);
      yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return yield* filesystem.readFileString(paths.join(root, INDEX_PATH));
    });

    it.effect("gets the generated region inserted ahead of the prose", () =>
      Effect.gen(function* program() {
        const indexText = yield* indexTextFixture;
        expect(indexText).toMatchInlineSnapshot(`
        "<!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->

        # A hand written index

        Prose and nothing else.
        "
      `);
      }),
    );
  });

  describe("a document that opens with frontmatter", () => {
    const indexTextFixture = Effect.gen(function* indexText() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, INDEX_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, INDEX_PATH),
        "---\ndescription: an index\n---\n\n# A hand written index\n",
      );
      yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return yield* filesystem.readFileString(paths.join(root, INDEX_PATH));
    });

    it.effect("takes the inserted region after the frontmatter", () =>
      Effect.gen(function* program() {
        const indexText = yield* indexTextFixture;
        expect(indexText).toMatchInlineSnapshot(`
        "---
        description: an index
        ---

        <!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->


        # A hand written index
        "
      `);
      }),
    );
  });

  describe("an opening fence that never closes", () => {
    const indexTextFixture = Effect.gen(function* indexText() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, INDEX_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, INDEX_PATH),
        "---\nThis line is not a fence.\n",
      );
      yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return yield* filesystem.readFileString(paths.join(root, INDEX_PATH));
    });

    it.effect("is treated as prose", () =>
      Effect.gen(function* program() {
        const indexText = yield* indexTextFixture;
        expect(indexText).toMatchInlineSnapshot(`
        "<!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->

        ---
        This line is not a fence.
        "
      `);
      }),
    );
  });

  describe("a stale region while the check only reads", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, INDEX_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, INDEX_PATH), STALE_REGION_INDEX);
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("is reported", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: INDEX_PATH, message: STALE_INDEX }],
          scanned: 1,
        });
      }),
    );
  });

  describe("a stale region while the check may write", () => {
    const indexTextFixture = Effect.gen(function* indexText() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, INDEX_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, INDEX_PATH), STALE_REGION_INDEX);
      yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return yield* filesystem.readFileString(paths.join(root, INDEX_PATH));
    });

    it.effect("is refreshed while the prose around it stays", () =>
      Effect.gen(function* program() {
        const indexText = yield* indexTextFixture;
        expect(indexText).toMatchInlineSnapshot(`
        "# An index

        Front matter prose.

        <!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |
        | [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | - |  |

        <!-- END GENERATED lint-rules -->

        Trailing prose.
        "
      `);
      }),
    );
  });

  describe("a region the formatter padded", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, INDEX_PATH)), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, INDEX_PATH),
        `# An index\n\n<!-- BEGIN GENERATED lint-rules -->\n\n| Rule                                        | Description        | Tool   | Notices |\n| ------------------------------------------- | ------------------ | ------ | ---- |\n| [no-thing--allow-it](./no-thing--allow-it.md) | Disallow the thing | -      |      |\n\n<!-- END GENERATED lint-rules -->\n`,
      );
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("still counts as fresh", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("two rules sharing a name while the check only reads", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/twin.ts"),
        RULE_SOURCE,
      );
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: false });
    });

    it.effect("are reported ahead of the missing index", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            { file: INDEX_PATH, message: DUPLICATED_RULE_NAME },
            { file: INDEX_PATH, message: MISSING_INDEX },
          ],
          scanned: 1,
        });
      }),
    );
  });

  describe("two rules sharing a name while the check may write", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/twin.ts"),
        RULE_SOURCE,
      );
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
    });

    it.effect("are reported even though the index gets written", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: INDEX_PATH, message: DUPLICATED_RULE_NAME }],
          scanned: 1,
        });
      }),
    );
  });

  describe("a shipped rule left outside the bundle directories a workspace has", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/core/no-thing--allow-it.ts"),
        RULE_SOURCE,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/no-stray--allow-it.ts"),
        STRAY_RULE_SOURCE,
      );
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
    });

    it.effect("is reported against the source that has to move", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: STRAY_RULE_PATH, message: UNBUNDLED_SHIPPED_RULE }],
          scanned: 1,
        });
      }),
    );
  });

  describe("a workspace with no rules yet while the check may write", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
    });

    it.effect("leaves nothing to report", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a workspace declaring a rule directory that is not there", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      return yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
    });

    it.effect("is reported against the manifest that declares it", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [{ file: "packages/example/package.json", message: ABSENT_RULE_DIRECTORY }],
          scanned: 1,
        });
      }),
    );
  });

  describe("the file a workspace with no rules yet gets", () => {
    const indexTextFixture = Effect.gen(function* indexText() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "reconcile-rule-index-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/package.json"),
        DECLARING_MANIFEST,
      );
      yield* lintRuleIndexProblems({ repositoryRoot: root, write: true });
      return yield* filesystem.readFileString(paths.join(root, INDEX_PATH));
    });

    it.effect("carries an empty table", () =>
      Effect.gen(function* program() {
        const indexText = yield* indexTextFixture;
        expect(indexText).toMatchInlineSnapshot(`
        "# Lint rule index

        Every lint rule this workspace implements. Generated from the rule sources; refresh it with \`dont-review-it check --write\` rather than editing it.

        <!-- BEGIN GENERATED lint-rules -->

        | Rule | Description | Tool | Notices |
        | --- | --- | --- | --- |

        <!-- END GENERATED lint-rules -->
        "
      `);
      }),
    );
  });
});

layer(NodeServices.layer)("formatLintRuleProblem", (it) => {
  describe("a problem naming the index it was found against", () => {
    const formattedProblemFixture = Effect.sync(() =>
      formatLintRuleProblem({ file: INDEX_PATH, message: MISSING_INDEX }),
    );

    it.effect("spells the path first and the message after it", () =>
      Effect.gen(function* program() {
        const formattedProblem = yield* formattedProblemFixture;
        expect(formattedProblem).toBe(`${INDEX_PATH} ${MISSING_INDEX}`);
      }),
    );
  });
});
