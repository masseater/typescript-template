import { dirname, join, resolve } from "node:path";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { isFile } from "../../lib/canonical-values/source-files.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import { LINT_CONFIGURATION_FILE } from "../../lib/lint-suppression/lint-config-suppression.ts";
import {
  suppressionDirectiveOf,
  type SuppressionDirective,
} from "../../lib/lint-suppression/suppression-directives.ts";
import { toPosixPath } from "../../lib/posix-path.ts";

import type { Comment, ESTree } from "@oxlint/plugins";
import type { RuleMessage } from "../../lib/rule-message.ts";

const STATEMENT_SCOPED_SPELLINGS: ReadonlySet<string> = new Set([
  "oxlint-disable-next-line",
  "eslint-disable-next-line",
]);

const LEDGER_FILE_NAME = "approved-lint-suppressions.json";

const BEFORE_SUPPRESSING =
  "Rewrite the code the rule reports before writing any suppression, and when the report is wrong, correct the condition that produced it instead of covering it.";

const REGISTERED_EXCEPTION =
  "Where an exception has to stand for a named file, register it in the lint configuration that names that file, never in a suppression comment and never in a repository ledger.";

const unmetConditionFor = (directive: SuppressionDirective): RuleMessage | null => {
  const spelling = { spelling: directive.spelling };
  if (directive.ruleNames.length === 0) return { messageId: "unnamedSuppression", data: spelling };
  if (!STATEMENT_SCOPED_SPELLINGS.has(directive.spelling)) {
    return { messageId: "wideSuppression", data: spelling };
  }
  if (directive.carriesGrounds) {
    return {
      messageId: "standingSuppression",
      data: { ruleNames: directive.ruleNames.join("`, `") },
    };
  }
  return {
    messageId: "groundlessSuppression",
    data: { ruleNames: directive.ruleNames.join("`, `") },
  };
};

const ledgerPresentAt = (repositoryRoot: string): boolean =>
  isFile(join(repositoryRoot, LEDGER_FILE_NAME));

export const noBlanketSuppression = createDontReviewItRule({
  name: "no-blanket-suppression--name-and-record",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow any lint suppression comment and disallow a repository ledger of approved suppressions, so a report ends in a repair to the code or a named exception in the lint configuration and never in a comment or a side file that takes the report away",
      relatedGuidelines: ["apps/internal-dashboard/content/docs/guidelines/enforcement.md"],
    },
    messages: {
      unnamedSuppression: `A \`{{spelling}}\` comment must not stand without naming the rule it stops. Delete it and rewrite the code the linter reports. ${BEFORE_SUPPRESSING} ${REGISTERED_EXCEPTION}`,
      wideSuppression: `A \`{{spelling}}\` comment must not take a scope other than the one statement below it. Delete it and rewrite the code the linter reports. ${BEFORE_SUPPRESSING} ${REGISTERED_EXCEPTION}`,
      groundlessSuppression: `A suppression of \`{{ruleNames}}\` must not stand. Delete it and rewrite the code that rule reports. ${BEFORE_SUPPRESSING} ${REGISTERED_EXCEPTION}`,
      standingSuppression: `A suppression of \`{{ruleNames}}\` must not stand, grounds or no grounds. Delete it and rewrite the code that rule reports. ${BEFORE_SUPPRESSING} ${REGISTERED_EXCEPTION}`,
      approvalLedger: `A repository must not hold \`${LEDGER_FILE_NAME}\`. Delete that file, delete every suppression comment it stood for, and rewrite the code those comments covered, or register a named-file exception in the lint configuration. ${REGISTERED_EXCEPTION}`,
    },
    schema: [],
  },
  create(inspection) {
    const absolutePath = resolve(inspection.cwd, inspection.filename);
    const repositoryRoot = findWorkspaceRoot(dirname(absolutePath));

    const reportDirective = ({
      comment,
      directive,
    }: {
      readonly comment: Comment;
      readonly directive: SuppressionDirective;
    }): void => {
      const unmet = unmetConditionFor(directive);
      if (unmet === null) return;
      inspection.report({ loc: comment.loc, ...unmet });
    };

    return {
      Program(node: ESTree.Program) {
        for (const comment of node.comments) {
          const directive = suppressionDirectiveOf(comment);
          if (directive !== null) reportDirective({ comment, directive });
        }
        if (!LINT_CONFIGURATION_FILE.test(toPosixPath(inspection.filename))) return;
        if (!ledgerPresentAt(repositoryRoot)) return;
        inspection.report({ node, messageId: "approvalLedger" });
      },
    };
  },
});
