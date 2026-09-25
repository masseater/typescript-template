import { describe, expect, test } from "vite-plus/test";

import { deploymentEnvironmentSettings, mainBranchRuleset } from "./rules.ts";

const address = { owner: "acme", repository: "widgets" };

describe("mainBranchRuleset", () => {
  const it = test.extend("acmeRuleset", () => mainBranchRuleset(address));

  it("requires a pull request and forbids deleting or force pushing main", ({ acmeRuleset }) => {
    expect(acmeRuleset).toStrictEqual({
      conditions: { include: ["refs/heads/main"] },
      enforcement: "active",
      name: "main",
      owner: "acme",
      repository: "widgets",
      rules: {
        deletion: true,
        nonFastForward: true,
        pullRequest: { requiredApprovingReviewCount: 0 },
      },
      target: "branch",
    });
  });
});

describe("deploymentEnvironmentSettings", () => {
  const it = test.extend("environments", () => deploymentEnvironmentSettings(address, "operator"));

  it("deploys only from main and holds production for the approver", ({ environments }) => {
    expect(environments).toStrictEqual({
      production: {
        deploymentBranchPolicy: { customBranchPolicies: ["main"] },
        name: "production",
        owner: "acme",
        preventSelfReview: false,
        repository: "widgets",
        reviewers: { users: ["operator"] },
      },
      staging: {
        deploymentBranchPolicy: { customBranchPolicies: ["main"] },
        name: "staging",
        owner: "acme",
        repository: "widgets",
      },
    });
  });
});
