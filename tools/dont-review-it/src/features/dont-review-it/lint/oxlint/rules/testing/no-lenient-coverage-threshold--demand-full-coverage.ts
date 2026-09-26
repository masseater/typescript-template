import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  CONFIG_OWNERS_KEY,
  CONFIG_OWNERS_SCHEMA,
  configOwnersFrom,
  declaredAt,
  declaredAtPath,
  ownerNamesIn,
  settlesTrue,
  writtenObjectOf,
} from "../../lib/config-owner.ts";
import { defaultExportedObject } from "../../lib/default-exported-object.ts";
import { isRecord } from "../../lib/record-value.ts";
import { isTestRunnerConfig } from "../../lib/test-runner-config.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const THRESHOLDS_PATH = ["test", "coverage", "thresholds"];

const PER_FILE_KEY = "perFile";

const FULL_COVERAGE = 100;

const THRESHOLD_SCHEMA = { type: "number", minimum: 0, maximum: FULL_COVERAGE } as const;

type CoverageRequirement = {
  readonly metric: string;
  readonly required: number;
};

const COVERAGE_METRICS = ["branches", "functions", "lines", "statements"];

const requirementsFrom = (ruleOptions: Readonly<Options>): readonly CoverageRequirement[] => {
  const [first] = ruleOptions;
  const overrides = isRecord(first) ? first : {};
  return COVERAGE_METRICS.map((metric) => {
    const override = overrides[metric];
    return { metric, required: typeof override === "number" ? override : FULL_COVERAGE };
  });
};

const requirementSummaryOf = (requirements: readonly CoverageRequirement[]): string =>
  requirements.map(({ metric, required }) => `\`${metric}\` to ${required}`).join(", ");

const declaredNumberOf = (literal: ESTree.Expression): number | null =>
  literal.type === "Literal" && typeof literal.value === "number" ? literal.value : null;

type CoverageViolation = {
  readonly node: ESTree.ObjectExpression | ESTree.ObjectProperty;
  readonly messageId: string;
  readonly data: Record<string, number | string>;
};

const violationsIn = ({
  thresholds,
  requirements,
  ownerNames,
}: {
  readonly thresholds: ESTree.ObjectExpression;
  readonly requirements: readonly CoverageRequirement[];
  readonly ownerNames: ReadonlySet<string>;
}): readonly CoverageViolation[] => {
  const shorthand = declaredAt({ object: thresholds, key: String(FULL_COVERAGE), ownerNames });
  const shorthandDemandsFullCoverage = shorthand.kind === "written" && settlesTrue(shorthand);
  return requirements.flatMap<CoverageViolation>(({ metric, required }) => {
    if (shorthandDemandsFullCoverage && required <= FULL_COVERAGE) return [];
    const settled = declaredAt({ object: thresholds, key: metric, ownerNames });
    if (settled.kind === "owned") return [];
    const unset = { messageId: "unsetCoverageThreshold", data: { metric, required } };
    if (settled.kind !== "written") return [{ node: thresholds, ...unset }];
    const declared = declaredNumberOf(settled.value);
    if (declared === null) return [{ node: settled.property, ...unset }];
    return declared >= required
      ? []
      : [
          {
            node: settled.property,
            messageId: "lenientCoverageThreshold",
            data: { metric, required, declared },
          },
        ];
  });
};

export const noLenientCoverageThreshold = createDontReviewItRule({
  name: "no-lenient-coverage-threshold--demand-full-coverage",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the test config to demand full coverage on every metric, so the amount of untested code that is allowed to stay is a decision written down once rather than whatever the suite happens to reach",
      relatedGuidelines: [".claude/skills/reviews/references/test-design.md"],
    },
    messages: {
      missingCoverageThresholds:
        "A test config must not measure coverage without demanding a number. `{{path}}` is absent from this config. Add it and set {{requirement}} together with `perFile: true`.",
      aggregateCoverageThreshold:
        "A coverage threshold must not be checked against the package total. `perFile` is not set to `true` in `test.coverage.thresholds`. Add it.",
      unsetCoverageThreshold:
        "A coverage metric must not be left without a threshold. `{{metric}}` carries no number in `test.coverage.thresholds`. Set it to {{required}}.",
      lenientCoverageThreshold:
        "A coverage threshold must not sit below what this repository demands. `{{metric}}` is declared as {{declared}} against a demanded {{required}}. Raise it to {{required}} and cover the code that made you lower it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          branches: THRESHOLD_SCHEMA,
          functions: THRESHOLD_SCHEMA,
          lines: THRESHOLD_SCHEMA,
          statements: THRESHOLD_SCHEMA,
          [CONFIG_OWNERS_KEY]: CONFIG_OWNERS_SCHEMA,
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isTestRunnerConfig(inspection.filename)) return {};
    const requirements = requirementsFrom(inspection.options);
    const owners = configOwnersFrom(inspection.options);

    return {
      Program(node: ESTree.Program) {
        const config = defaultExportedObject(node);
        const ownerNames = ownerNamesIn(node, owners);
        const declared =
          config === null
            ? null
            : declaredAtPath({ object: config, path: THRESHOLDS_PATH, ownerNames });
        if (declared?.kind === "owned") return;
        const thresholds = declared === null ? null : writtenObjectOf(declared);
        if (thresholds === null) {
          inspection.report({
            node,
            messageId: "missingCoverageThresholds",
            data: {
              path: THRESHOLDS_PATH.join("."),
              requirement: requirementSummaryOf(requirements),
            },
          });
          return;
        }
        if (!settlesTrue(declaredAt({ object: thresholds, key: PER_FILE_KEY, ownerNames }))) {
          inspection.report({ node: thresholds, messageId: "aggregateCoverageThreshold" });
        }
        for (const violation of violationsIn({ thresholds, requirements, ownerNames })) {
          inspection.report(violation);
        }
      },
    };
  },
});
