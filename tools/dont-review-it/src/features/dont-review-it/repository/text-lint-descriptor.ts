import { repositoryRoot } from "@repo/config/repository-root";
import aiWriting from "@textlint-ja/textlint-rule-preset-ai-writing";
import { TextlintKernelDescriptor, type TextlintKernelRule } from "@textlint/kernel";
import markdown from "@textlint/textlint-plugin-markdown";
import { Effect, Schema } from "effect";
import noRedundantExpression from "textlint-rule-ja-no-redundant-expression";
import noDoubledConjunction from "textlint-rule-no-doubled-conjunction";
import noExclamationQuestionMark from "textlint-rule-no-exclamation-question-mark";
import noMixDearuDesumasu from "textlint-rule-no-mix-dearu-desumasu";
import aiWordsJa from "textlint-rule-preset-ai-words-ja";

import { noOtherDocumentLocation } from "./no-other-document-location.ts";

import type { TextlintRuleModule } from "@textlint/types";

const RuleOptions = Schema.Union([Schema.Boolean, Schema.Record(Schema.String, Schema.Unknown)]);
type RuleOptions = typeof RuleOptions.Type;

interface Preset {
  readonly rules: Readonly<Record<string, TextlintRuleModule>>;
  readonly rulesConfig: unknown;
}

const hasDefault = <Module>(
  loaded: Module | { readonly default: Module },
): loaded is { readonly default: Module } =>
  typeof loaded === "object" && loaded !== null && "default" in loaded;

const commonJsDefault = <Module>(loaded: Module | { readonly default: Module }): Module =>
  hasDefault(loaded) ? loaded.default : loaded;

const aiWritingPreset = commonJsDefault<Preset>(aiWriting);
const aiWordsPreset = commonJsDefault<Preset>(aiWordsJa);
const markdownPlugin = commonJsDefault<typeof markdown.default>(markdown);
const redundantExpression = commonJsDefault<TextlintRuleModule>(noRedundantExpression);
const doubledConjunction = commonJsDefault<TextlintRuleModule>(noDoubledConjunction);

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
    presetRules("@textlint-ja/ai-writing", aiWritingPreset, {
      "ai-tech-writing-guideline": false,
      "no-ai-hype-expressions": false,
    }),
    presetRules("ai-words-ja", aiWordsPreset, {
      "no-ai-words": { dictionaryPath: "./.textlint-ai-words.json" },
    }),
  ]);
  return new TextlintKernelDescriptor({
    configBaseDir: repositoryRoot,
    filterRules: [],
    plugins: [
      { pluginId: "@textlint/textlint-plugin-markdown", plugin: markdownPlugin, options: true },
    ],
    rules: [
      {
        ruleId: "ja-no-redundant-expression",
        rule: redundantExpression,
        options: { dictOptions: { dict6: { disabled: true } } },
      },
      { ruleId: "no-doubled-conjunction", rule: doubledConjunction, options: true },
      { ruleId: "no-exclamation-question-mark", rule: noExclamationQuestionMark, options: true },
      { ruleId: "no-mix-dearu-desumasu", rule: noMixDearuDesumasu, options: true },
      { ruleId: "no-other-document-location", rule: noOtherDocumentLocation, options: true },
      ...aiWritingRules,
      ...aiWordsRules,
    ],
  });
});

export { textlintDescriptor };
