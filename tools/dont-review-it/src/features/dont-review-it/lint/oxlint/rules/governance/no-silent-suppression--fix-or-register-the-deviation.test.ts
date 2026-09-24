import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { noSilentSuppression } from "./no-silent-suppression--fix-or-register-the-deviation.ts";

const GUARDED_RULE = "no-split-type-authority--rename-or-unify";

const CONFIG_FILE = "vite.config.ts";

describe("dont-review-it/no-silent-suppression--fix-or-register-the-deviation", () => {
  testLintRule(noSilentSuppression, {
    valid: [
      {
        name: "a guarded rule held at the level that fails a run passes",
        documented: true,
        code: `export default { lint: { rules: { "dont-review-it/${GUARDED_RULE}": "error" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a rule outside the guarded set may sit at any level",
        code: `export default { lint: { rules: { "no-console": "off" } } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "ignore patterns naming the declared regions are the walk's own definition",
        code: `export default { lint: { ignorePatterns: ["**/dist/**", "node_modules", "coverage/**"] } };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a lint configuration this rule cannot read holds nothing to report",
        code: "export default { test: { coverage: {} } };",
        filename: CONFIG_FILE,
      },
      {
        name: "a file that is not the lint configuration is not read",
        code: `export default { lint: { rules: { "dont-review-it/${GUARDED_RULE}": "off" } } };`,
        filename: "rules-snapshot.ts",
      },
      {
        name: "a suppression comment is left to the rule that rejects every suppression comment",
        code: `// oxlint-disable-next-line ${GUARDED_RULE}\nexport default { lint: {} };`,
        filename: CONFIG_FILE,
      },
      {
        name: "a rule taken out of the guarded set by the options is no longer covered",
        code: `export default { lint: { rules: { "dont-review-it/${GUARDED_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        options: [{ guardedRules: ["require-catalog-entry--register-shared-dependency"] }],
      },
      {
        name: "a region declared by the options is part of the walk's definition",
        code: `export default { lint: { ignorePatterns: ["**/generated/**"] } };`,
        filename: CONFIG_FILE,
        options: [{ excludedRegions: ["generated"] }],
      },
      {
        name: "an ignore pattern that reaches no registered forbidden path passes",
        code: `export default { lint: { ignorePatterns: ["**/dist/**"] } };`,
        filename: CONFIG_FILE,
        options: [{ forbiddenPaths: ["legacy/settings.json"] }],
      },
    ],
    invalid: [
      {
        name: "a guarded rule turned off in the configuration is reported",
        documented: true,
        code: `export default { lint: { rules: { "dont-review-it/${GUARDED_RULE}": "off" } } };`,
        filename: CONFIG_FILE,
        errors: [
          {
            messageId: "weakenedRule",
            data: { ruleName: `dont-review-it/${GUARDED_RULE}`, severity: "off" },
          },
        ],
      },
      {
        name: "a guarded rule lowered to a warning inside an override is reported",
        code: `export default { lint: { overrides: [{ files: ["apps/**"], rules: { "${GUARDED_RULE}": "warn" } }] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule", data: { ruleName: GUARDED_RULE, severity: "warn" } }],
      },
      {
        name: "a guarded rule lowered inside the call that wraps the lint block is reported",
        code: `export default { lint: withGitExcludes({ rules: { "${GUARDED_RULE}": ["off", {}] } }) };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "weakenedRule" }],
      },
      {
        name: "an ignore pattern naming a place outside the declared regions is reported",
        documented: true,
        code: `export default { lint: { ignorePatterns: ["**/dist/**", "packages/legacy/**"] } };`,
        filename: CONFIG_FILE,
        errors: [{ messageId: "undeclaredIgnoredRegion", data: { pattern: "packages/legacy/**" } }],
      },
      {
        name: "an ignore pattern covering a registered forbidden path names that path",
        code: `export default { lint: { ignorePatterns: ["**/dist/**"] } };`,
        filename: CONFIG_FILE,
        options: [{ forbiddenPaths: ["packages/cart/dist/settings.json"] }],
        errors: [
          {
            messageId: "ignoredForbiddenPath",
            data: { forbiddenPath: "packages/cart/dist/settings.json" },
          },
        ],
      },
    ],
  });
});
