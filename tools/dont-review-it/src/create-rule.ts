import { createWorkspaceLintRule } from "@repo/lint-rule-authoring";

export const createDontReviewItRule = createWorkspaceLintRule({
  workspaceDir: "tools/dont-review-it",
});
