import { uniq } from "es-toolkit";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { LINT_SEVERITY } from "../../../../lint-rule-authoring/index.ts";
import { path } from "../../../../platform/path.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import {
  LINT_CONFIGURATION_FILE,
  lintBlockOf,
} from "../../lib/lint-suppression/lint-config-suppression.ts";
import { bareRuleNameOf } from "../../lib/lint-suppression/suppression-directives.ts";
import { objectPropertyOf, propertyKeyOf } from "../../lib/object-literal.ts";
import { toPosixPath } from "../../lib/posix-path.ts";
import { ruleBlockObjectOf } from "../../lib/rule-sets/configured-rule-blocks.ts";
import { severityLevelOf } from "../../lib/rule-sets/severity-levels.ts";
import {
  ignoredSpecFilesIn,
  scopeSpellingOf,
} from "../../lib/spec-lint-coverage/configured-scope.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const SILENCED_LEVELS: ReadonlySet<string> = new Set([LINT_SEVERITY.OFF, LINT_SEVERITY.WARN]);

const DIRECTIVE_RESPECT_KEY = "respectEslintDisableDirectives";

const GATE_SCHEMA = {
  type: "object",
  properties: { targetRules: { type: "array", items: { type: "string" } } },
  additionalProperties: false,
} as const;

const RULE_NAME = "no-rule-suppression--fix-the-violation";

const DETERMINISM_GATE_RULES: readonly string[] = [
  "no-module-scope-mock-config--lift-into-fixture",
  "no-module-scope-mutable-state--lift-into-fixture",
  "no-vi-mock-factory-behavior--use-spy-true-and-fixture",
  "no-redundant-mock-reset--lift-mocks-into-fixture",
  "no-local-file-system-mock--use-shared-fs",
  "no-fixture-ordering-alias--use-auto-action-fixture",
  "no-spec-specific-shared-setup--keep-setup-uniform",
  RULE_NAME,
];

const targetRulesFrom = (ruleOptions: Readonly<Options>): readonly string[] => {
  const [declared] = ruleOptions;
  if (typeof declared !== "object" || declared === null || Array.isArray(declared)) {
    return DETERMINISM_GATE_RULES;
  }
  const listed = declared.targetRules;
  const added = Array.isArray(listed)
    ? listed.filter((spelled): spelled is string => typeof spelled === "string")
    : [];
  return uniq([...DETERMINISM_GATE_RULES, ...added]);
};

export const noRuleSuppression = createDontReviewItRule({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow taking a rule of the parallel determinism gate out of a run through a lowered severity or an ignore entry, leaving the code the rule stands on as the only place a report ends",
      relatedGuidelines: [
        ".claude/skills/reviews/references/prove-every-guard-fails-on-a-violation.md",
      ],
    },
    messages: {
      weakenedRule:
        "A lint configuration must not hold `{{ruleName}}`, a rule of the parallel determinism gate, at `{{severity}}`. This entry takes the rule out of every run, and the invariant it carries goes unchecked across the whole tree. Set this entry to `error`, then rewrite the code the rule reports.",
      scopedWeakenedRule:
        "An override must not hold `{{ruleName}}`, a rule of the parallel determinism gate, at `{{severity}}` over {{scope}}. Those paths keep the code the rule reports and lose the report itself. Delete this entry, then rewrite the code the rule reports over those paths.",
      unreadableSeverity:
        "A severity this rule cannot read must not stand on `{{ruleName}}`, a rule of the parallel determinism gate. A value assembled elsewhere hides the level this gate runs at. Write the severity of this entry as the literal `error`.",
      respectedDisableDirectives:
        "A lint configuration must not hand the suppression comments of a run back their force. Every comment naming a rule of the parallel determinism gate starts taking that rule out of the run again. Set this entry to `false`, then delete the comments it was standing for.",
      ignoredSpecFile:
        "An ignore entry must not cover a file this gate reads. `{{pattern}}` covers `{{matchedPath}}`, an authored spec file, and every rule of the gate stops reporting over it. Narrow that pattern to the generated paths it stands for, or delete it and rewrite the code the gate reports.",
    },
    schema: [GATE_SCHEMA],
  },
  create(inspection) {
    const targetRules = targetRulesFrom(inspection.options);
    const named = new Set(targetRules.map(bareRuleNameOf));
    const configurationFile = LINT_CONFIGURATION_FILE.test(toPosixPath(inspection.filename));

    const reportEntry = (property: ESTree.ObjectProperty): void => {
      const ruleName = propertyKeyOf(property);
      if (ruleName === null || !named.has(bareRuleNameOf(ruleName))) return;
      const severity = severityLevelOf(property.value);
      if (severity === null) {
        inspection.report({ node: property, messageId: "unreadableSeverity", data: { ruleName } });
        return;
      }
      if (!SILENCED_LEVELS.has(severity)) return;
      const scope = scopeSpellingOf(property);
      const carried = { ruleName, severity };
      inspection.report({
        node: property,
        messageId: scope === null ? "weakenedRule" : "scopedWeakenedRule",
        data: scope === null ? carried : { ...carried, scope },
      });
    };

    const reportIgnoredSpecFiles = (program: ESTree.Program): void => {
      const lint = lintBlockOf(program);
      if (lint === null) return;
      const repositoryRoot = findWorkspaceRoot(
        path.dirname(path.resolve(inspection.cwd, inspection.filename)),
      );
      for (const ignored of ignoredSpecFilesIn({ lint, repositoryRoot })) {
        inspection.report({
          node: ignored.entry.element,
          messageId: "ignoredSpecFile",
          data: { pattern: ignored.entry.pattern, matchedPath: ignored.matchedPath },
        });
      }
    };

    return {
      ObjectExpression(node: ESTree.ObjectExpression) {
        const respected = objectPropertyOf({ object: node, key: DIRECTIVE_RESPECT_KEY });
        if (respected?.value.type === "Literal" && respected.value.value === true) {
          inspection.report({ node: respected, messageId: "respectedDisableDirectives" });
        }
        const rules = ruleBlockObjectOf(node);
        if (rules === null) return;
        for (const property of rules.properties) {
          if (property.type === "Property") reportEntry(property);
        }
      },
      "Program:exit"(node: ESTree.Program) {
        if (configurationFile) reportIgnoredSpecFiles(node);
      },
    };
  },
});
