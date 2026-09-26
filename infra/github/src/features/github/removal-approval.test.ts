import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { removalApprovalEnvironment, removalApprovalEnvironments } from "./index.ts";

describe("removalApprovalEnvironment", () => {
  const it = test.extend("stagingApproval", () =>
    removalApprovalEnvironment(
      { owner: "acme", repository: "widgets" },
      { environment: "staging-removal-approval", reviewer: "operator" },
    ));

  it("holds a deploy from main until the operator approves it", ({ stagingApproval }) => {
    expect(stagingApproval).toStrictEqual({
      deploymentBranchPolicy: { customBranchPolicies: ["main"] },
      name: "staging-removal-approval",
      owner: "acme",
      repository: "widgets",
      reviewers: { users: ["operator"] },
    });
  });
});

describe("the deploy workflow", () => {
  const it = test.extend("approvalEnvironmentsInWorkflow", () =>
    Effect.runPromise(
      Effect.gen(function* approvalJobs() {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const workflow = yield* fileSystem.readFileString(
          path.join(repositoryRoot, ".github/workflows/deploy.yml"),
        );
        return [...workflow.matchAll(/environment: (\S+-removal-approval)$/gmu)].map(
          (match) => match[1],
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("waits only on approval environments this stack declares", ({
    approvalEnvironmentsInWorkflow,
  }) => {
    expect(approvalEnvironmentsInWorkflow).toStrictEqual([...removalApprovalEnvironments]);
  });
});
