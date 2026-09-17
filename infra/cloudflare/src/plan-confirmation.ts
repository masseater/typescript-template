import { CONFIRMATION_LENGTH, CloudflareFailure } from "./config.ts";
import { Effect } from "effect";
import type { Stack as StackRoute } from "alchemy/Alchemist";
// oxlint-disable-next-line import/no-nodejs-modules
import { createHash } from "node:crypto";

const removingActions: ReadonlySet<string> = new Set(["delete", "orphaned", "replace"]);

interface PlanRow {
  readonly action: string;
  readonly id: string;
  readonly type: string;
}

interface PlanReport {
  readonly rows: readonly PlanRow[];
  readonly stack: string;
}

type PlannedStack = Pick<StackRoute.PlanSnapshot, "actions" | "resources" | "stack">;

function byRow(left: PlanRow, right: PlanRow): number {
  return (
    left.id.localeCompare(right.id) ||
    left.type.localeCompare(right.type) ||
    left.action.localeCompare(right.action)
  );
}

function planReport(planned: PlannedStack): PlanReport {
  return {
    rows: [
      ...planned.resources.map((resource) => ({
        action: resource.action,
        id: resource.logicalId,
        type: resource.resourceType,
      })),
      ...planned.actions.map((action) => ({
        action: action.action,
        id: action.logicalId,
        type: action.actionType,
      })),
    ].toSorted(byRow),
    stack: planned.stack.name,
  };
}

function planConfirmation(report: PlanReport): string {
  return createHash("sha256")
    .update(JSON.stringify(report))
    .digest("hex")
    .slice(0, CONFIRMATION_LENGTH);
}

function removedBy(report: PlanReport): readonly string[] {
  return report.rows.filter((row) => removingActions.has(row.action)).map((row) => row.id);
}

const acceptPlan = Effect.fn("acceptPlan")(function* acceptPlan(
  report: PlanReport,
  confirmation: string,
) {
  const removed = removedBy(report);
  if (removed.length > 0) {
    return yield* Effect.fail(
      new CloudflareFailure({ code: "plan_removes_resources", keys: removed }),
    );
  }
  if (planConfirmation(report) !== confirmation) {
    return yield* Effect.fail(
      new CloudflareFailure({ code: "plan_confirmation_mismatch", keys: [report.stack] }),
    );
  }
});

export { acceptPlan, planConfirmation, planReport };
export type { PlanReport, PlannedStack };
