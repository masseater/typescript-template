import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { shippedRuleReferenceProblems } from "./shipped-rule-reference.ts";

import type { BundledLintRule } from "./rule-bundle.ts";

const WORKSPACE_DIR = "packages/example";

const REFERENCE_PATH = "packages/example/skills/core/references/lint-rules.md";

const SKILL_PATH = "packages/example/skills/core/SKILL.md";

const SKILL_SOURCE = "---\nname: core\n---\n";

const rules: readonly BundledLintRule[] = [
  {
    name: "no-thing--allow-it",
    relatedGuidelines: [],
    unreadableGuidelines: 0,
    description: "Disallow the thing",
    sourcePath: "src/rules/no-thing--allow-it.ts",
    fixable: false,
    hasSuggestions: false,
    configurable: false,
    shipped: true,
    bundle: null,
    messages: [],
  },
];

const MISSING_REFERENCE = `A package that ships both lint rules and agent skills must not go without \`${REFERENCE_PATH}\`, because the rule documents stay in the repository and never reach an installed copy. Generate it with \`dont-review-it check --write\`.`;

const MISSING_MARKERS = `\`${REFERENCE_PATH}\` must not lose its generated region. Put \`<!-- BEGIN GENERATED shipped-lint-rules -->\` and \`<!-- END GENERATED shipped-lint-rules -->\` back, or delete the file and regenerate it with \`dont-review-it check --write\`.`;

const STALE_REFERENCE = `\`${REFERENCE_PATH}\` must not fall behind the rule implementations it lists. Regenerate it with \`dont-review-it check --write\`.`;

const HANDWRITTEN_REFERENCE = "# A reference someone typed\n\nProse only.\n";

const STALE_REGION_REFERENCE =
  "# Reference\n\n<!-- BEGIN GENERATED shipped-lint-rules -->\n\nan old table\n\n<!-- END GENERATED shipped-lint-rules -->\n";

const WRITTEN_REFERENCE = [
  "# Lint rules this package ships",
  "",
  "Every rule below is registered at error severity unless the table says the preset leaves it off. Generated from the rule implementations; regenerate with `dont-review-it check --write` rather than editing it.",
  "",
  "<!-- BEGIN GENERATED shipped-lint-rules -->",
  "",
  "| Rule | What it rejects | Notices |",
  "| --- | --- | --- |",
  "| [no-thing--allow-it](https://github.com/masseater/typescript-template/blob/main/packages/example/docs/lint/no-thing--allow-it.md) | Disallow the thing |  |",
  "",
  "<!-- END GENERATED shipped-lint-rules -->",
  "",
].join("\n");

layer(NodeServices.layer)("shippedRuleReferenceProblems", (it) => {
  describe("a workspace that declares rules but ships no skill", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "shipped-rule-reference-" });

      return yield* shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: false,
      });
    });

    it.effect("asks for no reference at all", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([]);
      }),
    );
  });

  describe("a reference that is missing while the check only reads", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "shipped-rule-reference-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, SKILL_PATH), SKILL_SOURCE);
      return yield* shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: false,
      });
    });

    it.effect("is reported against the path it should have been written to", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([{ file: REFERENCE_PATH, message: MISSING_REFERENCE }]);
      }),
    );
  });

  describe("a reference that is missing while the check may write", () => {
    const writtenFixture = Effect.gen(function* written() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "shipped-rule-reference-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/skills/core"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, SKILL_PATH), SKILL_SOURCE);
      yield* shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: true,
      });
      return yield* filesystem.readFileString(paths.join(root, REFERENCE_PATH));
    });

    it.effect("writes the table inside a generated region", () =>
      Effect.gen(function* program() {
        const written = yield* writtenFixture;
        expect(written).toBe(WRITTEN_REFERENCE);
      }),
    );
  });

  describe("a reference whose generated region was removed", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "shipped-rule-reference-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/skills/core/references"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, SKILL_PATH), SKILL_SOURCE);
      yield* filesystem.writeFileString(paths.join(root, REFERENCE_PATH), HANDWRITTEN_REFERENCE);
      return yield* shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: false,
      });
    });

    it.effect("asks for the markers back", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([{ file: REFERENCE_PATH, message: MISSING_MARKERS }]);
      }),
    );
  });

  describe("a reference whose region no longer matches the rules", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "shipped-rule-reference-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/skills/core/references"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, SKILL_PATH), SKILL_SOURCE);
      yield* filesystem.writeFileString(paths.join(root, REFERENCE_PATH), STALE_REGION_REFERENCE);
      return yield* shippedRuleReferenceProblems({
        repositoryRoot: root,
        workspaceDir: WORKSPACE_DIR,
        rules,
        write: false,
      });
    });

    it.effect("reports it as fallen behind the rule implementations", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([{ file: REFERENCE_PATH, message: STALE_REFERENCE }]);
      }),
    );
  });
});
