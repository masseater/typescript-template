import { createDontReviewItRule } from "../../../../create-rule.ts";
import { path } from "../../../../platform/path.ts";
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

const NEXT_LINE_SPELLING = "oxlint-disable-next-line";

const INERT_NEXT_LINE_SPELLING = "eslint-disable-next-line";

const LEDGER_FILE_NAME = "approved-lint-suppressions.json";

const BEFORE_SUPPRESSING =
  "Rewrite the code the rule reports first, and when the report is wrong, correct the condition that produced it.";

const NEXT_LINE_EXCEPTION = `Where the code has to stay as written, write \`${NEXT_LINE_SPELLING} <rule> -- <grounds>\` directly above that one line, and never widen the exception to a range, a file, or a package.`;

const OXLINT_GROUNDS_SEPARATOR = "--";

const unreadableRuleNameIn = (ruleNames: readonly string[]): string | undefined =>
  ruleNames.find((ruleName) => ruleName.includes(OXLINT_GROUNDS_SEPARATOR));

const unmetConditionFor = (directive: SuppressionDirective): RuleMessage | null => {
  const spelling = { spelling: directive.spelling };
  if (directive.ruleNames.length === 0) return { messageId: "unnamedSuppression", data: spelling };
  if (directive.spelling === INERT_NEXT_LINE_SPELLING) {
    return { messageId: "inertSuppression", data: spelling };
  }
  if (directive.spelling !== NEXT_LINE_SPELLING) {
    return { messageId: "wideSuppression", data: spelling };
  }
  const unreadableRuleName = unreadableRuleNameIn(directive.ruleNames);
  if (unreadableRuleName !== undefined) {
    return { messageId: "unreadableRuleName", data: { ruleName: unreadableRuleName } };
  }
  if (directive.carriesGrounds) return null;
  return {
    messageId: "groundlessSuppression",
    data: { ruleNames: directive.ruleNames.join("`, `") },
  };
};

const ledgerPresentAt = (repositoryRoot: string): boolean =>
  isFile(path.join(repositoryRoot, LEDGER_FILE_NAME));

export const noBlanketSuppression = createDontReviewItRule({
  name: "no-blanket-suppression--name-and-record",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a lint suppression comment that covers more than the next line, names no rule, or carries no grounds, and disallow a repository ledger of approved suppressions, so an exception covers only the line it stands above and says why it stands",
      relatedGuidelines: [".claude/skills/reviews/references/verification-and-automation.md"],
    },
    messages: {
      unnamedSuppression: `A \`{{spelling}}\` comment must name the rule it stops. ${BEFORE_SUPPRESSING} ${NEXT_LINE_EXCEPTION}`,
      wideSuppression: `A \`{{spelling}}\` comment must not take a scope wider than the next line. Delete it. ${BEFORE_SUPPRESSING} ${NEXT_LINE_EXCEPTION}`,
      inertSuppression: `A \`{{spelling}}\` comment stops nothing, since this configuration reads only the oxlint spelling. Delete it. ${BEFORE_SUPPRESSING} ${NEXT_LINE_EXCEPTION}`,
      groundlessSuppression: `A suppression of \`{{ruleNames}}\` must carry its grounds after \`--\` on the same line. Grounds repeating the rule name, or reading only as "false positive", count as none. ${BEFORE_SUPPRESSING} ${NEXT_LINE_EXCEPTION}`,
      unreadableRuleName: `A suppression comment must not name \`{{ruleName}}\`. oxlint reads \`${OXLINT_GROUNDS_SEPARATOR}\` as the start of the grounds, so the comment stops nothing. Delete it, and rewrite the code that rule reports.`,
      approvalLedger: `A repository must not hold \`${LEDGER_FILE_NAME}\`. Delete that file, and write each exception it stood for as a suppression comment above the one line it covers. ${NEXT_LINE_EXCEPTION}`,
    },
    schema: [],
  },
  create(inspection) {
    const absolutePath = path.resolve(inspection.cwd, inspection.filename);
    const repositoryRoot = findWorkspaceRoot(path.dirname(absolutePath));

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
