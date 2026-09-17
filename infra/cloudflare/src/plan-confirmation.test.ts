import { acceptPlan, planConfirmation, planReport } from "./plan-confirmation.ts";
import { assert, it } from "@effect/vitest";
import { CONFIRMATION_LENGTH } from "./config.ts";
import { Effect } from "effect";
import type { PlannedStack } from "./plan-confirmation.ts";

type PlannedResource = PlannedStack["resources"][number];
type PlannedAction = PlannedStack["actions"][number];

const stack = { name: "template-user", stage: "template-verify" };

function resource(kind: PlannedResource["action"], logicalId: string): PlannedResource {
  return {
    action: kind,
    bindings: [],
    fqn: `${stack.name}/${stack.stage}/${logicalId}`,
    logicalId,
    resourceType: "Cloudflare.Worker",
  };
}

function action(kind: PlannedAction["action"], logicalId: string): PlannedAction {
  return {
    action: kind,
    actionType: "Cloudflare.Migration",
    fqn: `${stack.name}/${stack.stage}/${logicalId}`,
    logicalId,
  };
}

const created: PlannedStack = {
  actions: [],
  resources: [resource("create", "Worker"), resource("noop", "Email")],
  stack,
};

const replaced: PlannedStack = {
  actions: [],
  resources: [resource("replace", "Worker")],
  stack,
};

const deleted: PlannedStack = {
  actions: [action("delete", "Migrate")],
  resources: [resource("noop", "Worker")],
  stack,
};

it.effect("derives one confirmation from the plan rows the preview printed", () =>
  Effect.sync(() => {
    const report = planReport(created);
    assert.deepStrictEqual(report, {
      rows: [
        { action: "noop", id: "Email", type: "Cloudflare.Worker" },
        { action: "create", id: "Worker", type: "Cloudflare.Worker" },
      ],
      stack: "template-user",
    });
    assert.notInclude(JSON.stringify(report), stack.stage);
    assert.match(planConfirmation(report), /^[0-9a-f]{16}$/u);
    assert.strictEqual(planConfirmation(report), planConfirmation(planReport(created)));
  }),
);

it.effect("a plan that gained a resource no longer matches the confirmation it was given", () =>
  Effect.gen(function* program() {
    const previous = planConfirmation(planReport(created));
    const grown = planReport({
      ...created,
      resources: [...created.resources, resource("create", "Queue")],
    });
    assert.notStrictEqual(planConfirmation(grown), previous);
    const failure = yield* acceptPlan(grown, previous).pipe(Effect.flip);
    assert.strictEqual(failure.code, "plan_confirmation_mismatch");
    assert.deepStrictEqual([...failure.keys], ["template-user"]);
  }),
);

it.effect("applies only when the confirmation names the plan that was just computed", () =>
  Effect.gen(function* program() {
    const report = planReport(created);
    assert.isUndefined(yield* acceptPlan(report, planConfirmation(report)));
    const wrongValues = [
      "",
      "0".repeat(CONFIRMATION_LENGTH),
      planConfirmation(report).toUpperCase(),
    ];
    for (const wrong of wrongValues) {
      const failure = yield* acceptPlan(report, wrong).pipe(Effect.flip);
      assert.strictEqual(failure.code, "plan_confirmation_mismatch");
    }
  }),
);

it.effect("refuses a plan that removes or replaces something, whatever confirmation is given", () =>
  Effect.gen(function* program() {
    for (const planned of [replaced, deleted]) {
      const report = planReport(planned);
      const failure = yield* acceptPlan(report, planConfirmation(report)).pipe(Effect.flip);
      assert.strictEqual(failure.code, "plan_removes_resources");
      assert.isAbove(failure.keys.length, 0);
    }
  }),
);
