import { Effect, Redacted } from "effect";
import type { PlannedAction, PlannedBinding, PlannedResource } from "alchemy/Report";
import { acceptPlan, planConfirmation, planReport } from "./plan-confirmation.ts";
import { assert, it } from "@effect/vitest";
import { CONFIRMATION_LENGTH } from "./config.ts";
import type { PlannedStack } from "./plan-confirmation.ts";
import { verificationSettings } from "./verification-fixture.ts";

const { accountId } = verificationSettings;
const otherAccountId = verificationSettings.zoneId;
const stack = { name: "template-user", stage: "acme" };

function fqn(logicalId: string): string {
  return `${stack.name}/${stack.stage}/${logicalId}`;
}

function resource(
  kind: PlannedResource["action"],
  logicalId: string,
  bindings: readonly PlannedBinding[] = [],
): PlannedResource {
  return {
    action: kind,
    bindings,
    fqn: fqn(logicalId),
    logicalId,
    resourceType: "Cloudflare.Worker",
  };
}

function action(kind: PlannedAction["action"], logicalId: string): PlannedAction {
  return { action: kind, actionType: "Cloudflare.Migration", fqn: fqn(logicalId), logicalId };
}

function planned(
  resources: readonly PlannedResource[],
  props: Readonly<Record<string, unknown>> = {},
  actions: readonly PlannedAction[] = [],
): PlannedStack {
  return { actions, props, resources, stack };
}

const workerProps = {
  domain: { name: "user.example.com", zoneId: verificationSettings.zoneId },
  env: { AUTH_SECRET: Redacted.make("first-secret-value") },
  name: "acme-user",
};

const created = planned(
  [resource("create", "Worker", [{ action: "create", sid: "DB" }]), resource("noop", "Email")],
  { [fqn("Worker")]: workerProps },
);

function token(target: PlannedStack, account = accountId): string {
  return planConfirmation(target, account);
}
function withProps(props: Readonly<Record<string, unknown>>): PlannedStack {
  return planned(created.resources, { [fqn("Worker")]: props });
}

it.effect("prints the rows and their bindings without the stage or any property value", () =>
  Effect.sync(() => {
    const report = planReport(created);
    assert.deepStrictEqual(report, {
      rows: [
        { action: "noop", bindings: [], id: "Email", type: "Cloudflare.Worker" },
        {
          action: "create",
          bindings: [{ action: "create", sid: "DB" }],
          id: "Worker",
          type: "Cloudflare.Worker",
        },
      ],
      stack: "template-user",
    });
    const printed = JSON.stringify(report);
    assert.notInclude(printed, stack.stage);
    assert.notInclude(printed, "user.example.com");
    assert.notInclude(printed, "first-secret-value");
  }),
);

it.effect("derives the same confirmation from the same plan and never leaks its inputs", () =>
  Effect.sync(() => {
    assert.match(token(created), new RegExp(`^[0-9a-f]{${CONFIRMATION_LENGTH}}$`, "u"));
    assert.strictEqual(token(created), token(planned([...created.resources], created.props)));
    assert.notInclude(token(created), stack.stage);
  }),
);

it.effect("binds the confirmation to the account, the stage, the props and the bindings", () =>
  Effect.sync(() => {
    const baseline = token(created);
    assert.notStrictEqual(token(created, otherAccountId), baseline);
    assert.notStrictEqual(
      token({ ...created, stack: { ...stack, stage: "other" } }),
      baseline,
      "a plan for another stage must not match",
    );
    const movedDomain = { ...workerProps, domain: { name: "evil.test", zoneId: otherAccountId } };
    assert.notStrictEqual(
      token(withProps(movedDomain)),
      baseline,
      "a changed custom domain must not match",
    );
    const rotated = { ...workerProps, env: { AUTH_SECRET: Redacted.make("second") } };
    assert.notStrictEqual(token(withProps(rotated)), baseline, "a changed secret must not match");
    const rebound = planned(
      [
        resource("create", "Worker", [{ action: "create", sid: "EMAIL" }]),
        resource("noop", "Email"),
      ],
      created.props,
    );
    assert.notStrictEqual(token(rebound), baseline, "a changed binding must not match");
  }),
);

it.effect("applies only when the confirmation names the plan that was just computed", () =>
  Effect.gen(function* program() {
    const confirmation = token(created);
    assert.isUndefined(yield* acceptPlan(created, { accountId, confirmation }));
    const wrong = ["", "0".repeat(CONFIRMATION_LENGTH), confirmation.toUpperCase()];
    for (const confirmed of wrong) {
      const failure = yield* acceptPlan(created, {
        accountId,
        confirmation: confirmed,
      }).pipe(Effect.flip);
      assert.strictEqual(failure.code, "plan_confirmation_mismatch");
    }
    const elsewhere = yield* acceptPlan(created, {
      accountId: otherAccountId,
      confirmation,
    }).pipe(Effect.flip);
    assert.strictEqual(elsewhere.code, "plan_confirmation_mismatch");
  }),
);

it.effect("refuses a plan that removes, replaces, adopts or drops a binding", () =>
  Effect.gen(function* program() {
    const refusals = [
      [planned([resource("replace", "Worker")]), "plan_removes_resources"],
      [planned([resource("orphaned", "Worker")]), "plan_removes_resources"],
      [planned([resource("adopted", "Worker")]), "plan_adopts_existing_resources"],
      [
        planned([resource("update", "Worker", [{ action: "delete", sid: "DB" }])]),
        "plan_removes_bindings",
      ],
      [
        planned([resource("noop", "Worker")], {}, [action("delete", "Migrate")]),
        "plan_removes_resources",
      ],
    ] as const;
    for (const [target, code] of refusals) {
      const failure = yield* acceptPlan(target, {
        accountId,
        confirmation: token(target),
      }).pipe(Effect.flip);
      assert.strictEqual(failure.code, code);
      assert.isAbove(failure.keys.length, 0);
    }
  }),
);
