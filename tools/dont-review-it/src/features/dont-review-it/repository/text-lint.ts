#!/usr/bin/env node
import { causeRecord, markFailed, runCli } from "@repo/cli";
import aiWriting from "@textlint-ja/textlint-rule-preset-ai-writing";
import {
  TextlintKernelDescriptor,
  type TextlintKernelRule,
  TextlintRuleSeverityLevelKeys,
} from "@textlint/kernel";
import markdown from "@textlint/textlint-plugin-markdown";
import { Effect, Schema } from "effect";
import { createLinter, loadLinterFormatter } from "textlint";
import noRedundantExpression from "textlint-rule-ja-no-redundant-expression";
import noDoubledConjunction from "textlint-rule-no-doubled-conjunction";
import noExclamationQuestionMark from "textlint-rule-no-exclamation-question-mark";
import noMixDearuDesumasu from "textlint-rule-no-mix-dearu-desumasu";
import aiWordsJa from "textlint-rule-preset-ai-words-ja";

import { path } from "../platform/path.ts";
import { repositoryRoot } from "./repository-root.ts";

import type { TextlintRuleModule } from "@textlint/types";

const RuleOptions = Schema.Union([Schema.Boolean, Schema.Record(Schema.String, Schema.Unknown)]);
type RuleOptions = typeof RuleOptions.Type;

interface Preset {
  readonly rules: Readonly<Record<string, TextlintRuleModule>>;
  readonly rulesConfig: unknown;
}

const presetRules = Effect.fn("presetRules")(function* presetRules(
  presetId: string,
  preset: Preset,
  overrides: Readonly<Record<string, Exclude<RuleOptions, true>>>,
) {
  const rulesConfig = yield* Schema.decodeUnknownEffect(Schema.Record(Schema.String, RuleOptions))(
    preset.rulesConfig,
  );
  return Object.entries(preset.rules).map(([ruleKey, rule]): TextlintKernelRule => ({
    ruleId: `${presetId}/${ruleKey}`,
    rule,
    options: overrides[ruleKey] ?? rulesConfig[ruleKey] ?? true,
  }));
});

const textlintDescriptor = Effect.gen(function* textlintDescriptor() {
  const [aiWritingRules, aiWordsRules] = yield* Effect.all([
    presetRules("@textlint-ja/ai-writing", aiWriting.default, {
      "ai-tech-writing-guideline": false,
      "no-ai-hype-expressions": false,
    }),
    presetRules("ai-words-ja", aiWordsJa.default, {
      "no-ai-words": { dictionaryPath: "./.textlint-ai-words.json" },
    }),
  ]);
  return new TextlintKernelDescriptor({
    configBaseDir: repositoryRoot,
    filterRules: [],
    plugins: [
      { pluginId: "@textlint/textlint-plugin-markdown", plugin: markdown.default, options: true },
    ],
    rules: [
      {
        ruleId: "ja-no-redundant-expression",
        rule: noRedundantExpression.default,
        options: { dictOptions: { dict6: { disabled: true } } },
      },
      { ruleId: "no-doubled-conjunction", rule: noDoubledConjunction.default, options: true },
      { ruleId: "no-exclamation-question-mark", rule: noExclamationQuestionMark, options: true },
      { ruleId: "no-mix-dearu-desumasu", rule: noMixDearuDesumasu, options: true },
      ...aiWritingRules,
      ...aiWordsRules,
    ],
  });
});

runCli(
  Effect.gen(function* lintText() {
    const descriptor = yield* textlintDescriptor;
    const results = yield* Effect.tryPromise(() =>
      createLinter({
        cwd: repositoryRoot,
        descriptor,
        ignoreFilePath: path.join(repositoryRoot, ".textlintignore"),
      }).lintFiles(["**/*.md"]),
    );
    const formatter = yield* Effect.tryPromise(() =>
      loadLinterFormatter({ color: true, formatterName: "stylish" }),
    );
    yield* Effect.sync(() => process.stdout.write(formatter.format(results)));
    if (
      results.some((result) =>
        result.messages.some((message) => message.severity === TextlintRuleSeverityLevelKeys.error),
      )
    ) {
      yield* markFailed;
    }
  }),
  (cause) => causeRecord("quality.text_lint_failed", { cause }),
);
