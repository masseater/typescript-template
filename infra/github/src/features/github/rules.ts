import type { EnvironmentProps, RulesetProps } from "alchemy/GitHub";
import type { RepositoryAddress } from "./repository.ts";

const mainBranchRuleset = (address: RepositoryAddress): RulesetProps => ({
  conditions: { include: ["refs/heads/main"] },
  enforcement: "active",
  name: "main-branch",
  owner: address.owner,
  repository: address.repository,
  rules: {
    deletion: true,
    nonFastForward: true,
    pullRequest: { requiredApprovingReviewCount: 0 },
  },
  target: "branch",
});

const rulesApplyEnvironment = "repository-settings";

const rulesApplyEnvironmentSettings = (address: RepositoryAddress): EnvironmentProps => ({
  deploymentBranchPolicy: { customBranchPolicies: ["main"] },
  name: rulesApplyEnvironment,
  owner: address.owner,
  repository: address.repository,
});

export { mainBranchRuleset, rulesApplyEnvironment, rulesApplyEnvironmentSettings };
