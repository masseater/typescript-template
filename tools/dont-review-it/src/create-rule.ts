import { createWorkspaceLintRule } from "@repo/dont-review-it/lint-rule-authoring";

export const createDontReviewItRule = createWorkspaceLintRule({
  workspaceDir: "tools/dont-review-it",
});
