import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  mainBranchRuleset,
  rulesApplyEnvironment,
  rulesApplyEnvironmentSettings,
} from "./rules.ts";

describe("mainBranchRuleset", () => {
  const it = test.extend("acmeRuleset", () =>
    mainBranchRuleset({ owner: "acme", repository: "widgets" }));

  it("requires a pull request and forbids deleting or force pushing main", ({ acmeRuleset }) => {
    expect(acmeRuleset).toStrictEqual({
      conditions: { include: ["refs/heads/main"] },
      enforcement: "active",
      name: "main-branch",
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

describe("rulesApplyEnvironmentSettings", () => {
  const it = test.extend("acmeEnvironment", () =>
    rulesApplyEnvironmentSettings({ owner: "acme", repository: "widgets" }));

  it("lets only main deploy to the environment that holds the admin token", ({
    acmeEnvironment,
  }) => {
    expect(acmeEnvironment).toStrictEqual({
      deploymentBranchPolicy: { customBranchPolicies: ["main"] },
      name: "repository-settings",
      owner: "acme",
      repository: "widgets",
    });
  });
});

describe("repository-settings workflow", () => {
  const it = test.extend("workflowEnvironment", () =>
    Effect.runPromise(
      Effect.gen(function* readWorkflow() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        return yield* filesystem.readFileString(
          paths.join(repositoryRoot, ".github", "workflows", "repository-settings.yml"),
        );
      }).pipe(
        Effect.map((workflow) => /^ {4}environment: (?<name>\S+)$/mu.exec(workflow)?.groups?.name),
        Effect.provide(NodeServices.layer),
      ),
    ));

  it("applies the rules from the environment that only main can deploy to", ({
    workflowEnvironment,
  }) => {
    expect(workflowEnvironment).toBe(rulesApplyEnvironment);
  });
});
