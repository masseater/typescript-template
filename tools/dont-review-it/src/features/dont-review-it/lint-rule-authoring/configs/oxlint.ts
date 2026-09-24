import { defineConfig } from "oxlint";

import { filePathOf } from "../../platform/path.ts";
import { LINT_SEVERITY } from "../lint-rule-severity.ts";
import { forbidSymbolPrefixedName } from "../lint/oxlint/rules/authoring/forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts";
import { noExplainedLintMessage } from "../lint/oxlint/rules/authoring/no-explained-lint-message--state-prohibition-then-fix.ts";

const PLUGIN_NAME = "lint-rule-authoring";

/** @public */
export const oxlint = defineConfig({
  jsPlugins: [
    { name: PLUGIN_NAME, specifier: filePathOf(new URL("../plugin.ts", import.meta.url)) },
  ],
  rules: {
    [`${PLUGIN_NAME}/${forbidSymbolPrefixedName.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExplainedLintMessage.name}`]: LINT_SEVERITY.ERROR,
  },
});
