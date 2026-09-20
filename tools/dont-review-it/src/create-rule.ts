import { createWorkspaceLintRule } from "./lint-rule-authoring/index.ts";

export const createDontReviewItRule = createWorkspaceLintRule({
  workspaceDir: "tools/dont-review-it",
});
