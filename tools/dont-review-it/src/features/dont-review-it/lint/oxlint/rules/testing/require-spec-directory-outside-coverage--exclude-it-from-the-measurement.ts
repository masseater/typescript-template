import { createDontReviewItRule } from "../../../../create-rule.ts";
import {
  CONFIG_OWNERS_KEY,
  CONFIG_OWNERS_SCHEMA,
  configOwnersFrom,
  declaredAt,
  declaredAtPath,
  ownerNamesIn,
  spreadsOwner,
  writtenObjectOf,
} from "../../lib/config-owner.ts";
import { defaultExportedObject } from "../../lib/default-exported-object.ts";
import { isRecord } from "../../lib/record-value.ts";
import { isTestRunnerConfig } from "../../lib/test-runner-config.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const COVERAGE_PATH = ["test", "coverage"];

const EXCLUDE_KEY = "exclude";

const DEFAULT_PATTERN = "specs/**";

const requiredPatternFrom = (ruleOptions: Readonly<Options>): string => {
  const [first] = ruleOptions;
  const declared = isRecord(first) ? first.pattern : undefined;
  return typeof declared === "string" ? declared : DEFAULT_PATTERN;
};

const spelledEntriesIn = (held: ESTree.ArrayExpression): readonly string[] =>
  held.elements.flatMap((listed) =>
    listed?.type === "Literal" && typeof listed.value === "string" ? [listed.value] : [],
  );

type ExclusionProblem = {
  readonly node: ESTree.Node;
  readonly messageId: "unmeasuredCoverageExclusion" | "includedSpecDirectory";
};

const excludesPattern = ({
  listed,
  pattern,
  ownerNames,
}: {
  readonly listed: ESTree.Expression;
  readonly pattern: string;
  readonly ownerNames: ReadonlySet<string>;
}): boolean =>
  listed.type === "ArrayExpression" &&
  (spreadsOwner(listed, ownerNames) || spelledEntriesIn(listed).includes(pattern));

const exclusionProblemIn = ({
  config,
  pattern,
  ownerNames,
}: {
  readonly config: ESTree.ObjectExpression;
  readonly pattern: string;
  readonly ownerNames: ReadonlySet<string>;
}): ExclusionProblem | null => {
  const declared = declaredAtPath({ object: config, path: COVERAGE_PATH, ownerNames });
  if (declared.kind === "absent" || declared.kind === "owned") return null;
  const coverage = writtenObjectOf(declared);
  if (coverage === null) {
    return {
      node: declared.kind === "written" ? declared.property : config,
      messageId: "unmeasuredCoverageExclusion",
    };
  }
  const excluded = declaredAt({ object: coverage, key: EXCLUDE_KEY, ownerNames });
  if (excluded.kind === "owned") return null;
  if (excluded.kind !== "written")
    return { node: coverage, messageId: "unmeasuredCoverageExclusion" };
  return excludesPattern({ listed: excluded.value, pattern, ownerNames })
    ? null
    : { node: excluded.value, messageId: "includedSpecDirectory" };
};

export const requireSpecDirectoryOutsideCoverage = createDontReviewItRule({
  name: "require-spec-directory-outside-coverage--exclude-it-from-the-measurement",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the test config to keep the specification directory out of the coverage measurement, so the number a run reports is what the tests beside the sources reached rather than what the specifications happened to touch",
      relatedGuidelines: [".claude/skills/reviews/references/test-design.md", "AGENTS.md"],
    },
    messages: {
      unmeasuredCoverageExclusion:
        "A test config that measures coverage must not go without `test.coverage.exclude`. Add it and put `{{pattern}}` in it, then secure coverage with tests beside the sources.",
      includedSpecDirectory:
        "The specification directory must not count toward the coverage measurement. `{{pattern}}` is absent from `test.coverage.exclude`. Add it, and cover the code from tests beside the sources instead.",
    },
    schema: [
      {
        type: "object",
        properties: { pattern: { type: "string" }, [CONFIG_OWNERS_KEY]: CONFIG_OWNERS_SCHEMA },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isTestRunnerConfig(inspection.filename)) return {};
    const pattern = requiredPatternFrom(inspection.options);
    const owners = configOwnersFrom(inspection.options);

    return {
      Program(node: ESTree.Program) {
        const config = defaultExportedObject(node);
        if (config === null) return;
        const ownerNames = ownerNamesIn(node, owners);
        const found = exclusionProblemIn({ config, pattern, ownerNames });
        if (found !== null) inspection.report({ ...found, data: { pattern } });
      },
    };
  },
});
