import type { RulesetProps } from "alchemy/GitHub";
import type { RepositoryAddress } from "./repository.ts";

const MAIN_BRANCH_REF = "refs/heads/main";
const MAIN_RULESET_NAME = "main";

const mainBranchRuleset = (address: RepositoryAddress): RulesetProps => ({
  conditions: { include: [MAIN_BRANCH_REF] },
  enforcement: "active",
  name: MAIN_RULESET_NAME,
  owner: address.owner,
  repository: address.repository,
  rules: {
    deletion: true,
    nonFastForward: true,
    pullRequest: { requiredApprovingReviewCount: 0 },
  },
  target: "branch",
});

export { mainBranchRuleset };
