import { createWorkspaceLintRule } from "@template/lint-rule-authoring";

export const createDontReviewItRule = createWorkspaceLintRule({
  workspaceDir: "tools/dont-review-it",
});
