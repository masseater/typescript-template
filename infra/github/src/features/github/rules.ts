import type { EnvironmentProps, RulesetProps } from "alchemy/GitHub";
import type { DeploymentEnvironment } from "./apply-target.ts";
import type { RepositoryAddress } from "./repository.ts";

const MAIN_BRANCH = "main";
const MAIN_BRANCH_REF = `refs/heads/${MAIN_BRANCH}`;
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

const mainOnlyEnvironment = (
  address: RepositoryAddress,
  environment: DeploymentEnvironment,
): EnvironmentProps => ({
  deploymentBranchPolicy: { customBranchPolicies: [MAIN_BRANCH] },
  name: environment,
  owner: address.owner,
  repository: address.repository,
});

const deploymentEnvironmentSettings = (
  address: RepositoryAddress,
  approver: string,
): Readonly<Record<DeploymentEnvironment, EnvironmentProps>> => ({
  production: {
    ...mainOnlyEnvironment(address, "production"),
    preventSelfReview: false,
    reviewers: { users: [approver] },
  },
  staging: mainOnlyEnvironment(address, "staging"),
});

export { deploymentEnvironmentSettings, mainBranchRuleset };
