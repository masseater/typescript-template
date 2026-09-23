import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import {
  LINT_BUNDLE,
  type LintBundleSelection,
} from "../src/features/dont-review-it/configs/bundles/bundle-names.ts";
import { BUNDLE_RULES } from "../src/features/dont-review-it/configs/oxlint.ts";
import { dontReviewItPreset } from "../src/features/dont-review-it/index.ts";
import { childDirectoryNamesIn } from "../src/features/dont-review-it/platform/file-system.ts";
import { runChecks } from "../src/features/dont-review-it/run-checks.ts";

const placedRuleNamesIn = ({
  bundle,
  directories,
  rulesDirectory,
}: {
  readonly bundle: string;
  readonly directories: ReadonlySet<string>;
  readonly rulesDirectory: string;
}) =>
  Effect.gen(function* placedRuleNamesIn() {
    if (!directories.has(bundle)) return [];
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const fileNames = yield* filesystem.readDirectory(paths.join(rulesDirectory, bundle));
    return fileNames
      .filter((fileName) => fileName.endsWith(".ts") && !fileName.endsWith(".test.ts"))
      .map((fileName) => fileName.slice(0, -".ts".length));
  });

const strayRuleNames = Effect.gen(function* strayRuleNames() {
  const paths = yield* Path.Path;
  const rulesDirectory = paths.join(
    import.meta.dirname,
    "../src/features/dont-review-it/lint/oxlint/rules",
  );
  const directories = new Set(yield* childDirectoryNamesIn(rulesDirectory));
  const perBundle = yield* Effect.forEach(Object.entries(BUNDLE_RULES), ([bundle, rules]) =>
    Effect.gen(function* bundleDrift() {
      const placed = yield* placedRuleNamesIn({ bundle, directories, rulesDirectory });
      const declared: readonly string[] = rules.map((rule) => rule.name);
      return [
        ...placed.filter((ruleName) => !declared.includes(ruleName)),
        ...declared.filter((ruleName) => !placed.includes(ruleName)),
      ].map((ruleName) => `${bundle}/${ruleName}`);
    }),
  );
  return perBundle.flat().toSorted();
});

const PLUGIN_PREFIX = "dont-review-it/";

const ruleIdsFor = (bundles: LintBundleSelection): readonly string[] =>
  (dontReviewItPreset.lint({ bundles }).extends ?? [])
    .filter((extended) => typeof extended !== "string")
    .flatMap((extended) => Object.keys(extended.rules ?? {}))
    .filter((ruleId) => ruleId.startsWith(PLUGIN_PREFIX));

const GOVERNANCE_RULE = `${PLUGIN_PREFIX}no-blanket-suppression--name-and-record`;

const WRITING_RULE = `${PLUGIN_PREFIX}no-default-export--use-named-export`;

const TESTING_RULE = `${PLUGIN_PREFIX}require-it-only-expect--move-setup-into-fixture`;

const SINGLE_OWNERSHIP_RULE = `${PLUGIN_PREFIX}no-twin-declaration--merge-into-one-owner`;

layer(NodeServices.layer)("束ごとの採用", (it) => {
  it.effect("束が持つルールと、その束のディレクトリに立っているルールが一致している", () =>
    Effect.gen(function* program() {
      expect(yield* strayRuleNames).toStrictEqual([]);
    }),
  );

  it.effect("すべてを採ると、どの束のルールも入る", () =>
    Effect.sync(() => {
      const ruleIds = ruleIdsFor("all");

      expect(ruleIds).toContain(GOVERNANCE_RULE);
      expect(ruleIds).toContain(WRITING_RULE);
      expect(ruleIds).toContain(TESTING_RULE);
      expect(ruleIds).toContain(SINGLE_OWNERSHIP_RULE);
    }),
  );

  it.effect("名指しした束のルールだけが入る", () =>
    Effect.sync(() => {
      const ruleIds = ruleIdsFor([LINT_BUNDLE.testing]);

      expect(ruleIds).toContain(TESTING_RULE);
      expect(ruleIds).not.toContain(WRITING_RULE);
      expect(ruleIds).not.toContain(SINGLE_OWNERSHIP_RULE);
    }),
  );

  it.effect("報告を消す経路を塞ぐ束は、名指ししなくても入る", () =>
    Effect.sync(() => {
      const ruleIds = ruleIdsFor([]);

      expect(ruleIds).toContain(GOVERNANCE_RULE);
    }),
  );

  it.effect("報告を消す経路を塞ぐ束だけを名指ししても、二重には入らない", () =>
    Effect.sync(() => {
      const ruleIds = ruleIdsFor([LINT_BUNDLE.governance]);

      expect(ruleIds.filter((ruleId) => ruleId === GOVERNANCE_RULE)).toStrictEqual([
        GOVERNANCE_RULE,
      ]);
    }),
  );

  it.effect("採っていない束の検査は、走らせずに理由を添えて並べる", () =>
    Effect.gen(function* program() {
      const filesystem = yield* FileSystem.FileSystem;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-bundles-",
      });
      const paths = yield* Path.Path;
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "vite.config.ts"),
        `import { dontReviewItPreset } from "@repo/dont-review-it";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: dontReviewItPreset.lint({ bundles: ["testing"] }),
});
`,
      );
      const byCheck = new Map(
        (yield* runChecks(repositoryRoot)).outcomes.map((ranCheck) => [
          ranCheck.check,
          ranCheck.skippedReason,
        ]),
      );

      expect(byCheck.get("canonical-values")).toBe("bundle not adopted");
      expect(byCheck.get("workflow-definitions")).toBe("bundle not adopted");
      expect(byCheck.get("shippable-packages")).toBe("bundle not adopted");
    }),
  );

  it.effect("束を名指ししていないツールチェーン設定では、どの検査も走る", () =>
    Effect.gen(function* program() {
      const filesystem = yield* FileSystem.FileSystem;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-bundles-",
      });
      const skipped = (yield* runChecks(repositoryRoot)).outcomes.filter(
        (ranCheck) => ranCheck.skippedReason === "bundle not adopted",
      );

      expect(skipped).toStrictEqual([]);
    }),
  );

  it.effect("テストの束を採らないと、仕様担保テストの置き場に与える設定も入らない", () =>
    Effect.sync(() => {
      const withoutTesting = dontReviewItPreset.lint({ bundles: [LINT_BUNDLE.writing] });
      const carried = (withoutTesting.extends ?? [])
        .filter((extended) => typeof extended !== "string")
        .flatMap((extended) => extended.overrides ?? []);

      expect(carried.flatMap((override) => override.files)).not.toContain("**/specs/**/*.ts");
    }),
  );
});
