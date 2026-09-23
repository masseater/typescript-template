import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { noBlanketSuppression } from "./no-blanket-suppression--name-and-record.ts";

const REASSIGN_RULE = "no-reassign--use-spread-or-iife";

const STATEMENT = "element.total = 1;";

const GROUNDS = "the platform interface writes the total back into the element";

const LEDGER_FILE_NAME = "approved-lint-suppressions.json";

const ledgerRoot = mkdtempSync(join(tmpdir(), "dont-review-it-approval-ledger-"));
mkdirSync(ledgerRoot, { recursive: true });
writeFileSync(join(ledgerRoot, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
writeFileSync(join(ledgerRoot, LEDGER_FILE_NAME), "[]");

describe("dont-review-it/no-blanket-suppression--name-and-record", () => {
  testLintRule(noBlanketSuppression, {
    valid: [
      { name: "source that suppresses nothing passes", code: STATEMENT },
      {
        name: "a comment the linter does not read as a directive is not a suppression",
        code: `// the running total the checkout screen reads\n${STATEMENT}`,
      },
      {
        name: "a doc block that mentions a directive is not a directive",
        code: `/**\n * @see oxlint-disable\n */\n${STATEMENT}`,
      },
      {
        name: "re-enabling a rule is not a suppression",
        code: `// oxlint-enable ${REASSIGN_RULE}\n${STATEMENT}`,
      },
    ],
    invalid: [
      {
        name: "a whole-file directive naming no rule is reported for naming none",
        documented: true,
        code: `// oxlint-disable\n${STATEMENT}`,
        errors: [{ messageId: "unnamedSuppression", data: { spelling: "oxlint-disable" } }],
      },
      {
        name: "a next-line directive naming no rule is reported for naming none",
        code: `// oxlint-disable-next-line -- ${GROUNDS}\n${STATEMENT}`,
        errors: [
          { messageId: "unnamedSuppression", data: { spelling: "oxlint-disable-next-line" } },
        ],
      },
      {
        name: "a whole-file directive naming a rule is reported for its scope",
        documented: true,
        code: `/* oxlint-disable ${REASSIGN_RULE} -- ${GROUNDS} */\n${STATEMENT}`,
        errors: [{ messageId: "wideSuppression", data: { spelling: "oxlint-disable" } }],
      },
      {
        name: "the eslint spelling of a whole-file directive is reported the same way",
        code: `// eslint-disable ${REASSIGN_RULE} -- ${GROUNDS}\n${STATEMENT}`,
        errors: [{ messageId: "wideSuppression", data: { spelling: "eslint-disable" } }],
      },
      {
        name: "a same-line directive is reported for covering a statement other than the one below it",
        code: `${STATEMENT} // oxlint-disable-line ${REASSIGN_RULE} -- ${GROUNDS}`,
        errors: [{ messageId: "wideSuppression", data: { spelling: "oxlint-disable-line" } }],
      },
      {
        name: "a directive written without a grounds separator is reported",
        code: `// oxlint-disable-next-line ${REASSIGN_RULE}\n${STATEMENT}`,
        errors: [{ messageId: "groundlessSuppression", data: { ruleNames: REASSIGN_RULE } }],
      },
      {
        name: "grounds spelled as the rule name alone are no grounds",
        code: `// oxlint-disable-next-line ${REASSIGN_RULE} -- ${REASSIGN_RULE}\n${STATEMENT}`,
        errors: [{ messageId: "groundlessSuppression" }],
      },
      {
        name: "grounds spelled as a claim of a wrong report are no grounds",
        code: `// oxlint-disable-next-line ${REASSIGN_RULE} -- false positive\n${STATEMENT}`,
        errors: [{ messageId: "groundlessSuppression" }],
      },
      {
        name: "a next-line directive that names its rule and carries grounds is still reported",
        documented: true,
        code: `// oxlint-disable-next-line ${REASSIGN_RULE} -- ${GROUNDS}\n${STATEMENT}`,
        errors: [{ messageId: "standingSuppression", data: { ruleNames: REASSIGN_RULE } }],
      },
      {
        name: "a rule name carrying its plugin prefix is still reported",
        code: `// oxlint-disable-next-line dont-review-it/${REASSIGN_RULE} -- ${GROUNDS}\n${STATEMENT}`,
        errors: [
          {
            messageId: "standingSuppression",
            data: { ruleNames: `dont-review-it/${REASSIGN_RULE}` },
          },
        ],
      },
      {
        name: "each directive in a file is reported on its own",
        code: `// oxlint-disable-next-line ${REASSIGN_RULE}\n${STATEMENT}\n// oxlint-disable-next-line ${REASSIGN_RULE}\n${STATEMENT}`,
        errors: [{ messageId: "groundlessSuppression" }, { messageId: "groundlessSuppression" }],
      },
      {
        name: "a repository ledger of approved suppressions is reported at the lint configuration",
        code: "export default { lint: {} };",
        filename: join(ledgerRoot, "vite.config.ts"),
        errors: [{ messageId: "approvalLedger" }],
      },
    ],
  });
});
