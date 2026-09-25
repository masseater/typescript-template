import { inMemoryState } from "alchemy";
import { type ResourceState, State } from "alchemy/State";
import { Effect, Result } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { moveStackState, refuseLegacyState } from "./state-migration.ts";

const legacyStack = { stack: "acme-github", stage: "acme" };
const repositoryStack = { stack: "template-github", stage: "repository" };
const mainRulesetState: ResourceState = {
  attr: { rulesetId: 7 },
  bindings: [],
  downstream: [],
  fqn: "Main",
  instanceId: "main-instance",
  logicalId: "Main",
  namespace: undefined,
  props: {},
  providerVersion: 0,
  resourceType: "GitHub.Ruleset",
  status: "created",
};

describe("moveStackState", () => {
  describe.for([
    [
      "state left under the prefix",
      { [legacyStack.stack]: { [legacyStack.stage]: { Main: mainRulesetState } } },
      {
        failure: undefined,
        left: [],
        moved: ["Main"],
        movedOutput: { rulesetId: 7 },
        placed: ["Main"],
      },
    ],
    [
      "nothing left under the prefix",
      {},
      { failure: undefined, left: [], moved: [], movedOutput: undefined, placed: [] },
    ],
    [
      "a stack that already has state",
      {
        [legacyStack.stack]: { [legacyStack.stage]: { Main: mainRulesetState } },
        [repositoryStack.stack]: { [repositoryStack.stage]: { Main: mainRulesetState } },
      },
      {
        failure: ["state_target_occupied", "template-github/repository"],
        left: ["Main"],
        moved: undefined,
        movedOutput: undefined,
        placed: ["Main"],
      },
    ],
  ] as const)("%s", ([, seed, promised]) => {
    const it = test.extend("migration", () =>
      Effect.gen(function* migrate() {
        const store = yield* Effect.flatten(State);
        const moved = yield* Effect.result(
          moveStackState(store, { from: legacyStack, to: repositoryStack }).pipe(
            Effect.catchTag("StateStoreError", Effect.die),
          ),
        );
        return {
          failure: Result.isFailure(moved)
            ? [moved.failure.code, ...moved.failure.keys]
            : undefined,
          left: yield* store.list(legacyStack),
          moved: Result.getOrUndefined(moved),
          movedOutput: yield* store.getOutput(repositoryStack),
          placed: yield* store.list(repositoryStack),
        };
      }).pipe(
        Effect.provide(
          inMemoryState(structuredClone(seed), {
            [legacyStack.stack]: { [legacyStack.stage]: { rulesetId: 7 } },
          }),
        ),
        Effect.runPromise,
      ));

    it("moves every row and the output once, and never onto existing state", ({ migration }) => {
      expect(migration).toStrictEqual(promised);
    });
  });
});

describe("refuseLegacyState", () => {
  describe.for([
    [
      "state left under the prefix",
      { [legacyStack.stack]: { [legacyStack.stage]: { Main: mainRulesetState } } },
      ["legacy_state_present", "acme-github/acme"],
    ],
    ["no state under the prefix", {}, undefined],
  ] as const)("%s", ([, seed, promised]) => {
    const it = test.extend("refusal", () =>
      Effect.flatten(State).pipe(
        Effect.flatMap((store) =>
          Effect.result(
            refuseLegacyState(store, legacyStack).pipe(
              Effect.catchTag("StateStoreError", Effect.die),
            ),
          ),
        ),
        Effect.map((refused) =>
          Result.isFailure(refused) ? [refused.failure.code, ...refused.failure.keys] : undefined,
        ),
        Effect.provide(inMemoryState(structuredClone(seed))),
        Effect.runPromise,
      ));

    it("stops planning until the old state is moved", ({ refusal }) => {
      expect(refusal).toStrictEqual(promised);
    });
  });
});
