import { createWorkspaceLintRule } from "./create-workspace-lint-rule.ts";

export const createLintRuleAuthoringRule = createWorkspaceLintRule({
  workspaceDir: "tools/dont-review-it",
});
