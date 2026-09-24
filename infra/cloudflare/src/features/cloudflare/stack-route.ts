import { Progress, Stack as StackRoute } from "alchemy/Alchemist";
import { Effect } from "effect";

import type { ProgressEvent } from "alchemy/Alchemist";

type PlanRoute = ReturnType<typeof StackRoute.plan>;
type PlanSnapshot = Effect.Success<PlanRoute>;

const planDeployment = (
  target: StackRoute.StackTarget,
): Effect.Effect<PlanSnapshot, never, Effect.Services<PlanRoute>> =>
  StackRoute.plan({ operation: "deploy", target }).pipe(Effect.orDie);

const applyDeployment = (
  snapshot: PlanSnapshot,
  report: (event: ProgressEvent) => Effect.Effect<void>,
): Effect.Effect<void, Effect.Error<ReturnType<typeof StackRoute.apply>>> =>
  StackRoute.apply(snapshot).pipe(Effect.provideService(Progress, report), Effect.asVoid);

export { applyDeployment, planDeployment };
export type { PlanRoute, PlanSnapshot };
