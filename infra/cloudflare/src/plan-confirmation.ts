import { createHash } from "node:crypto";

import { ExprSymbol, isExpr as isOutputExpr } from "alchemy/Output";
import { Effect, Redacted } from "effect";

import { CONFIRMATION_LENGTH, CloudflareFailure } from "./config.ts";

import type { Stack as StackRoute } from "alchemy/Alchemist";
import type { Plan } from "alchemy/Plan";
import type { PlannedAction, PlannedBinding, PlannedResource } from "alchemy/Report";

type RowAction = PlannedAction["action"] | PlannedResource["action"];

type PlanRow = {
  readonly action: RowAction;
  readonly bindings: readonly PlannedBinding[];
  readonly id: string;
  readonly props: string;
  readonly type: string;
};

type PlanReport = {
  readonly rows: readonly Omit<PlanRow, "props">[];
  readonly stack: string;
};

type PlannedStack = Pick<StackRoute.PlanSnapshot, "actions" | "resources" | "stack"> & {
  readonly props: Readonly<Record<string, unknown>>;
};

const digest = (value: unknown): string => {
  return createHash("sha256")
    .update(JSON.stringify({ value }))
    .digest("hex")
    .slice(0, CONFIRMATION_LENGTH);
};

const EXPRESSION_FIELDS = ["expr", "f", "identifier", "kind", "resourceId", "stack", "stage"];

const stableExpression = (value: object, seen: ReadonlySet<unknown>): unknown => {
  const node: unknown = Reflect.get(value, ExprSymbol);
  if (typeof node !== "object" || node === null) {
    return { kind: "expression" };
  }
  const nested = new Set([...seen, value, node]);
  const source: unknown = Reflect.get(node, "src");
  const logicalId: unknown =
    typeof source === "object" && source !== null ? Reflect.get(source, "LogicalId") : undefined;
  return {
    ...Object.fromEntries(
      EXPRESSION_FIELDS.flatMap((field) => {
        const found: unknown = Reflect.get(node, field);

        return found === undefined ? [] : [[field, stable(found, nested)] as const];
      }),
    ),
    ...(typeof logicalId === "string" ? { logicalId } : {}),
  };
};

const stableEntries = (value: object, seen: ReadonlySet<unknown>): unknown => {
  const nested = new Set([...seen, value]);
  if (Array.isArray(value)) {
    return value.map((item: unknown) => stable(item, nested));
  }
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left]: readonly [string, unknown], [right]: readonly [string, unknown]) =>
        left.localeCompare(right),
      )

      .map(([key, item]: readonly [string, unknown]) => [key, stable(item, nested)] as const),
  );
};

const stable = (value: unknown, seen: ReadonlySet<unknown>): unknown => {
  if (Redacted.isRedacted(value)) {
    return { redacted: digest(String(Redacted.value(value))) };
  }
  if (isOutputExpr(value)) {
    return seen.has(value) ? "<cycle>" : stableExpression(value, seen);
  }
  if (typeof value === "function" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return seen.has(value) ? "<cycle>" : stableEntries(value, seen);
};

const byBinding = (left: PlannedBinding, right: PlannedBinding): number => {
  return left.sid.localeCompare(right.sid) || left.action.localeCompare(right.action);
};

const byRow = (left: PlanRow, right: PlanRow): number => {
  return (
    left.id.localeCompare(right.id) ||
    left.type.localeCompare(right.type) ||
    left.action.localeCompare(right.action)
  );
};

const planRows = (planned: PlannedStack): readonly PlanRow[] => {
  return [
    ...planned.resources.map((resource) => ({
      action: resource.action,
      bindings: resource.bindings
        .map((binding) => ({ action: binding.action, sid: binding.sid }))
        .toSorted(byBinding),
      id: resource.logicalId,
      props: digest(stable(planned.props[resource.fqn], new Set())),
      type: resource.resourceType,
    })),
    ...planned.actions.map((action) => ({
      action: action.action,
      bindings: [],
      id: action.logicalId,
      props: digest(stable(planned.props[action.fqn], new Set())),
      type: action.actionType,
    })),
  ].toSorted(byRow);
};

const planReport = (planned: PlannedStack): PlanReport => {
  return {
    rows: planRows(planned).map(({ action, bindings, id, type }) => ({
      action,
      bindings,
      id,
      type,
    })),
    stack: planned.stack.name,
  };
};

type Refusal = {
  readonly code: CloudflareFailure["code"];
  readonly id: string;
};

const refused = (code: CloudflareFailure["code"] | undefined, id: string): readonly Refusal[] => {
  return code === undefined ? [] : [{ code, id }];
};

const bindingDisposition = {
  create: undefined,
  delete: "plan_removes_bindings",
  noop: undefined,
  update: undefined,
} as const satisfies Record<PlannedBinding["action"], CloudflareFailure["code"] | undefined>;

const refusedBindings = (row: PlanRow): readonly Refusal[] => {
  return row.bindings.flatMap((binding) =>
    refused(bindingDisposition[binding.action], `${row.id}.${binding.sid}`),
  );
};

const rowDisposition = {
  adopted: "plan_adopts_existing_resources",
  create: undefined,
  delete: "plan_removes_resources",
  noop: undefined,
  orphaned: "plan_removes_resources",
  replace: "plan_removes_resources",
  run: undefined,
  update: undefined,
} as const satisfies Record<RowAction, CloudflareFailure["code"] | undefined>;

const resourceProps = (nodes: Plan["resources"]): readonly (readonly [string, unknown])[] => {
  return Object.entries(nodes).map(
    ([fqn, node]: readonly [string, Plan["resources"][string]]) =>
      [fqn, node.action === "noop" ? undefined : node.props] as const,
  );
};

const actionInputs = (nodes: Plan["actions"]): readonly (readonly [string, unknown])[] => {
  return Object.entries(nodes).map(
    ([fqn, node]: readonly [string, Plan["actions"][string]]) =>
      [fqn, node.action === "run" ? node.input : undefined] as const,
  );
};

const plannedStack = (
  snapshot: Pick<StackRoute.PlanSnapshot, "actions" | "native" | "resources" | "stack">,
): PlannedStack => {
  return {
    actions: snapshot.actions,
    props: Object.fromEntries([
      ...resourceProps(snapshot.native.resources),
      ...actionInputs(snapshot.native.actions),
    ]),
    resources: snapshot.resources,
    stack: snapshot.stack,
  };
};

const planConfirmation = (planned: PlannedStack, accountId: string): string => {
  return digest({
    account: digest(accountId),
    rows: planRows(planned),
    stack: planned.stack.name,
    stage: digest(planned.stack.stage),
  });
};

const refusedRows = (planned: PlannedStack): readonly Refusal[] => {
  const rows = planRows(planned);
  return [
    ...rows.flatMap((row) => refused(rowDisposition[row.action], row.id)),
    ...rows.flatMap((row) => refusedBindings(row)),
  ];
};

const acceptPlan = Effect.fn("acceptPlan")(function* acceptPlan(
  planned: PlannedStack,
  approval: { readonly accountId: string; readonly confirmation: string },
) {
  const refusals = refusedRows(planned);
  const code = refusals[0]?.code;
  if (code !== undefined) {
    return yield* Effect.fail(
      new CloudflareFailure({
        code,
        keys: refusals.filter((row) => row.code === code).map((row) => row.id),
      }),
    );
  }
  if (planConfirmation(planned, approval.accountId) !== approval.confirmation) {
    return yield* Effect.fail(
      new CloudflareFailure({
        code: "plan_confirmation_mismatch",
        keys: [planned.stack.name],
      }),
    );
  }
});

export { acceptPlan, planConfirmation, planReport, plannedStack };
export type { PlanReport, PlannedStack };
