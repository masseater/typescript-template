import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { noWeakenedProtectedRule } from "./no-weakened-protected-rule--register-the-exception-in-configuration.ts";

const PROTECTED_RULE = "forbid-tracked-path--untrack-and-ignore";

const SELF_RULE = "no-weakened-protected-rule--register-the-exception-in-configuration";

const CONFIG_FILE = "vite.config.ts";

describe("dont-review-it/no-weakened-protected-rule--register-the-exception-in-configuration", () => {
  testLintRule(noWeakenedProtectedRule, {
    valid: [
      {
        name: "a protected rule held at the level that fails a run passes",
        documented: true,
        code: `export default { lint: { rules: { "dont-review-it/${PROTECTED_RULE}": "error" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a rule outside the protected set may sit at any level",
        code: `export default { lint: { rules: { "no-console": "off" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "an override listing the complete path of every file it covers is the registered exception",
        documented: true,
        code: `export default { lint: { overrides: [{ files: ["packages/cart/src/settings.ts", "apps/site/src/entry.ts"], rules: { "${PROTECTED_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a lint configuration this rule cannot read holds nothing to report",
        code: "export default { test: { coverage: {} } };",
        filename: CONFIG_FILE,
      },
      {
        name: "a file that is not the lint configuration is not read",
        code: `export default { lint: { rules: { "${PROTECTED_RULE}": "off" } } };`,
        filename: "rules-snapshot.ts",
      },
      {
        name: "a suppression comment is left to the rule that rejects every suppression comment",
        code: `// oxlint-disable-next-line ${PROTECTED_RULE}\nexport const total = 1;`,
      },
      {
        name: "a configuration inside a build output path is outside the authored surface",
        code: `export default { lint: { rules: { "${PROTECTED_RULE}": "off" } } };`,
        filename: "packages/cart/dist/vite.config.ts",
      },
      {
        name: "a path the options name as generated is outside the authored surface too",
        code: `export default { lint: { rules: { "${PROTECTED_RULE}": "off" } } };`,
        filename: "packages/cart/schema/vite.config.ts",
        options: [{ generatedPaths: ["**/schema/**"] }],
      },
      {
        name: "a deviation carrying grounds takes its rule out of the protected set",
        code: `export default { lint: { rules: { "${PROTECTED_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        options: [
          { unprotected: [{ rule: PROTECTED_RULE, reason: "the registry owns this path list" }] },
        ],
      },
    ],
    invalid: [
      {
        name: "a protected rule turned off in the configuration is reported",
        documented: true,
        code: `export default { lint: { rules: { "dont-review-it/${PROTECTED_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "weakenedProtectedRule",
            data: { ruleName: `dont-review-it/${PROTECTED_RULE}`, severity: "off" },
          },
        ],
      },
      {
        name: "a rule the options add to the protected set is covered by it",
        code: `export default { lint: { rules: { "no-console": "off" } } };`,
        filename: CONFIG_FILE,
        options: [{ protectedRules: ["no-console"] }],
        errors: [
          {
            messageId: "weakenedProtectedRule",
            data: { ruleName: "no-console", severity: "off" },
          },
        ],
      },
      {
        name: "an exception scoped by a pattern is not a registered exception",
        documented: true,
        code: `export default { lint: { overrides: [{ files: ["packages/*/dist/**"], rules: { "${PROTECTED_RULE}": "warn" } }] } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "patternScopedException",
            data: { ruleName: PROTECTED_RULE, severity: "warn", pattern: "packages/*/dist/**" },
          },
        ],
      },
      {
        name: "an override that names no file it covers is not a registered exception",
        code: `export default { lint: { overrides: [{ rules: { "${PROTECTED_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedProtectedRule" }],
      },
      {
        name: "an override whose files this rule cannot read is not a registered exception",
        code: `export default { lint: { overrides: [{ files: [chosenPath], rules: { "${PROTECTED_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedProtectedRule" }],
      },
      {
        name: "an override that keeps its file list elsewhere is not a registered exception",
        code: `export default { lint: { overrides: [{ files: chosenPaths, rules: { "${PROTECTED_RULE}": "off" } }] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedProtectedRule" }],
      },
      {
        name: "a deviation without grounds is reported where the configuration stands",
        code: `export default { lint: { rules: {} } };`,
        filename: CONFIG_FILE,
        options: [{ unprotected: [{ rule: PROTECTED_RULE, reason: "  " }] }],
        errors: [{ messageId: "groundlessDeviation", data: { ruleName: PROTECTED_RULE } }],
      },
      {
        name: "a deviation without grounds leaves its rule protected",
        code: `export default { lint: { rules: { "${PROTECTED_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        options: [{ unprotected: [{ rule: PROTECTED_RULE }] }],
        errors: [
          { messageId: "groundlessDeviation", data: { ruleName: PROTECTED_RULE } },
          {
            messageId: "weakenedProtectedRule",
            data: { ruleName: PROTECTED_RULE, severity: "off" },
          },
        ],
      },
      {
        name: "a deviation naming this rule is reported and leaves this rule protected",
        code: `export default { lint: { rules: { "${SELF_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        options: [
          { unprotected: [{ rule: SELF_RULE, reason: "this repository writes its own rules" }] },
        ],
        errors: [
          { messageId: "selfDeviation", data: { ruleName: SELF_RULE } },
          { messageId: "weakenedProtectedRule", data: { ruleName: SELF_RULE, severity: "off" } },
        ],
      },
    ],
  });
});
