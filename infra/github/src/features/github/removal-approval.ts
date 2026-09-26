import type { EnvironmentProps } from "alchemy/GitHub";
import type { RepositoryAddress } from "./repository.ts";

const removalApprovalEnvironments = [
  "staging-removal-approval",
  "production-removal-approval",
] as const;

const removalApprovalEnvironment = (
  address: RepositoryAddress,
  approval: Readonly<{
    environment: (typeof removalApprovalEnvironments)[number];
    reviewer: string;
  }>,
): EnvironmentProps => ({
  deploymentBranchPolicy: { customBranchPolicies: ["main"] },
  name: approval.environment,
  owner: address.owner,
  repository: address.repository,
  reviewers: { users: [approval.reviewer] },
});

export { removalApprovalEnvironment, removalApprovalEnvironments };
