import { describe, expect, test } from "vite-plus/test";

import { mainBranchRuleset } from "./rules.ts";

describe("mainBranchRuleset", () => {
  const it = test.extend("acmeRuleset", () =>
    mainBranchRuleset({ owner: "acme", repository: "widgets" }));

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
