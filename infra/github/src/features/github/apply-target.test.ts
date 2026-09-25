import { Stage } from "alchemy";
import { Effect, Result } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { DeploymentEnvironment, applyTarget, legacyTarget, stagedAt } from "./apply-target.ts";

describe("applyTarget", () => {
  describe.for([
    [{ unit: "github" }, { stack: "template-github", stage: "repository" }],
    [
      { environment: "staging", unit: "wiki-publisher" },
      { stack: "template-wiki-publisher", stage: "staging" },
    ],
    [
      { environment: "production", unit: "wiki-publisher" },
      { stack: "template-wiki-publisher", stage: "production" },
    ],
  ] as const)("%o", ([selection, promised]) => {
    const it = test.extend("stackTarget", () => applyTarget(selection));

    it("names the stack after the apply unit alone and stages it at the Environment", ({
      stackTarget,
    }) => {
      expect(stackTarget).toStrictEqual(promised);
    });
  });
});

describe("legacyTarget", () => {
  const it = test.extend("legacyStack", () => legacyTarget("wiki-publisher", "acme"));

  it("points at the stack the prefix used to own", ({ legacyStack }) => {
    expect(legacyStack).toStrictEqual({ stack: "acme-wiki-publisher", stage: "acme" });
  });
});

describe("stagedAt", () => {
  describe.for([
    ["production", "production"],
    ["acme", 'SchemaError(Expected "staging" | "production")'],
  ] as const)("the stage %s", ([stage, promised]) => {
    const it = test.extend("stagedRun", () =>
      Effect.runPromise(
        Effect.result(
          stagedAt(DeploymentEnvironment, (environment) => Effect.succeed(environment)),
        ).pipe(
          Effect.map((staged) =>
            Result.isSuccess(staged) ? staged.success : staged.failure.message,
          ),
          Effect.provideService(Stage, stage),
        ),
      ));

    it("runs the program only under a declared stage", ({ stagedRun }) => {
      expect(stagedRun).toBe(promised);
    });
  });
});
