import { createDontReviewItRule } from "../../../../create-rule.ts";
import { matchesGlobPath } from "../../lib/glob-path-match.ts";
import {
  ignoreEntriesIn,
  LINT_CONFIGURATION_FILE,
  lintBlockOf,
  weakenedTargetRulesIn,
  type IgnoreEntry,
} from "../../lib/lint-suppression/lint-config-suppression.ts";
import { segmentsOf } from "../../lib/path-segments.ts";
import { toPosixPath } from "../../lib/posix-path.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const RULE_NAME = "no-silent-suppression--fix-or-register-the-deviation";

const GUARDED_RULES = [
  "no-split-type-authority--rename-or-unify",
  "no-duplicate-value-declaration--reuse-authoritative-value",
  "require-catalog-entry--register-shared-dependency",
  RULE_NAME,
];

const EXCLUDED_REGIONS = [".git", "node_modules", "dist", "coverage"];

const STRING_LIST_SCHEMA = { type: "array", items: { type: "string" } } as const;

const configuredListOf = (
  ruleOptions: Readonly<Options>,
  { name, carried }: { readonly name: string; readonly carried: readonly string[] },
): readonly string[] => {
  const [declared] = ruleOptions;
  if (typeof declared !== "object" || declared === null || Array.isArray(declared)) return carried;
  const listed = declared[name];
  if (!Array.isArray(listed)) return carried;
  return listed.filter((candidate): candidate is string => typeof candidate === "string");
};

const namesDeclaredRegion = ({
  pattern,
  excludedRegions,
}: {
  readonly pattern: string;
  readonly excludedRegions: readonly string[];
}): boolean =>
  segmentsOf({ path: pattern, separator: "/" }).some((segment) =>
    excludedRegions.includes(segment),
  );

export const noSilentSuppression = createDontReviewItRule({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a lint configuration lowering a rule that keeps one declaration in one place, or ignoring a path outside the regions the repository excludes, so what the linter stops saying is a decision somebody wrote down",
      relatedGuidelines: [".claude/skills/reviews/references/verification-and-automation.md"],
    },
    messages: {
      weakenedRule:
        "A lint configuration must not hold `{{ruleName}}` at `{{severity}}`, a level that leaves a run green. Set it to `error`, rewrite the code that rule reports, or register the deviation in the list that rule keeps.",
      undeclaredIgnoredRegion:
        "An ignore pattern must not name `{{pattern}}`, a place outside the regions this repository excludes from the walk. Delete the pattern and rewrite the code it hides, or declare the region in the definition this configuration receives.",
      ignoredForbiddenPath:
        "An ignore pattern must not cover `{{forbiddenPath}}`, a path registered as forbidden. Delete the pattern, and delete that file or move it to the place its owner names.",
    },
    schema: [
      {
        type: "object",
        properties: {
          guardedRules: STRING_LIST_SCHEMA,
          excludedRegions: STRING_LIST_SCHEMA,
          forbiddenPaths: STRING_LIST_SCHEMA,
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!LINT_CONFIGURATION_FILE.test(toPosixPath(inspection.filename))) return {};

    const guardedRules = configuredListOf(inspection.options, {
      name: "guardedRules",
      carried: GUARDED_RULES,
    });
    const excludedRegions = configuredListOf(inspection.options, {
      name: "excludedRegions",
      carried: EXCLUDED_REGIONS,
    });
    const forbiddenPaths = configuredListOf(inspection.options, {
      name: "forbiddenPaths",
      carried: [],
    });

    const hiddenForbiddenPathOf = (pattern: string): string | undefined =>
      forbiddenPaths.find((forbiddenPath) =>
        matchesGlobPath({
          pathSegments: segmentsOf({ path: toPosixPath(forbiddenPath), separator: "/" }),
          pattern,
          cwd: inspection.cwd,
        }),
      );

    const reportIgnoreEntry = (listed: IgnoreEntry): void => {
      const hidden = hiddenForbiddenPathOf(listed.pattern);
      if (hidden !== undefined) {
        inspection.report({
          node: listed.element,
          messageId: "ignoredForbiddenPath",
          data: { forbiddenPath: hidden },
        });
        return;
      }
      if (namesDeclaredRegion({ pattern: listed.pattern, excludedRegions })) return;
      inspection.report({
        node: listed.element,
        messageId: "undeclaredIgnoredRegion",
        data: { pattern: listed.pattern },
      });
    };

    return {
      Program(node: ESTree.Program) {
        const lint = lintBlockOf(node);
        if (lint === null) return;
        for (const weakened of weakenedTargetRulesIn({ lint, targetRules: guardedRules })) {
          inspection.report({
            node: weakened.property,
            messageId: "weakenedRule",
            data: { ruleName: weakened.ruleName, severity: weakened.severity },
          });
        }
        for (const listed of ignoreEntriesIn(lint)) reportIgnoreEntry(listed);
      },
    };
  },
});
