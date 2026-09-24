import { forbidSymbolPrefixedName } from "./lint/oxlint/rules/authoring/forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts";
import { noExplainedLintMessage } from "./lint/oxlint/rules/authoring/no-explained-lint-message--state-prohibition-then-fix.ts";

import type { Plugin } from "@oxlint/plugins";

const plugin: Plugin = {
  meta: { name: "lint-rule-authoring" },
  rules: {
    [forbidSymbolPrefixedName.name]: forbidSymbolPrefixedName,
    [noExplainedLintMessage.name]: noExplainedLintMessage,
  },
};

/** @public */
export default plugin;
