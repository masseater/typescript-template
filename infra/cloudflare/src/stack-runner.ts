import type { DeploymentRequest, SharedConfig } from "./config.ts";
import { Progress, Stack as StackRoute, layer } from "alchemy/Alchemist";
import { acceptPlan, planConfirmation, planReport } from "./plan-confirmation.ts";
import { ArtifactWrites } from "./artifacts.ts";
import type { DeploymentSecrets } from "./credentials.ts";
import { Effect } from "effect";
import type { PlanReport } from "./plan-confirmation.ts";
import type { ProgressEvent } from "alchemy/Alchemist";
import type { StackName } from "./stacks.ts";
import { assertDatabaseUnclaimed } from "./database-guard.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { stackName } from "./stacks.ts";

type DeploymentTarget = Pick<SharedConfig, "accountId" | "prefix">;

const alchemist = layer();

function write(record: Readonly<Record<string, unknown>>): Effect.Effect<void> {
  return Effect.sync(() => {
    // oxlint-disable-next-line no-console
    console.info(JSON.stringify(record));
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function reportProgress(stack: StackName): (event: ProgressEvent) => Effect.Effect<void> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  return (event) =>
    event._tag === "apply.resource.status"
      ? write({
          event: "cloudflare.resource",
          id: event.id,
          stack,
          status: event.status,
          type: event.type,
        })
      : Effect.void;
}

const planStack = Effect.fn("planStack")(function* planStack(
  stack: StackName,
  envFile: string,
  stage: string,
) {
  const snapshot = yield* StackRoute.plan({
    operation: "deploy",
    target: {
      entrypoint: fileURLToPath(new URL(`${stack}.ts`, import.meta.url)),
      envFile,
      stage,
    },
  });
  return { report: planReport(snapshot), snapshot };
});

function announce(report: PlanReport, stack: StackName): Effect.Effect<void> {
  return write({
    confirmation: planConfirmation(report),
    event: "cloudflare.planned",
    plan: report,
    stack,
  });
}

const planAll = Effect.fn("planAll")(function* planAll(
  stacks: readonly StackName[],
  secrets: DeploymentSecrets,
  target: DeploymentTarget,
) {
  for (const stack of stacks) {
    const { report } = yield* planStack(stack, secrets.filename, target.prefix);
    yield* announce(report, stack);
  }
});

const applyStack = Effect.fn("applyStack")(function* applyStack(
  requested: { readonly confirmation: string; readonly stack: StackName },
  secrets: DeploymentSecrets,
  target: DeploymentTarget,
) {
  const { confirmation, stack } = requested;
  if (stack === "database") {
    yield* assertDatabaseUnclaimed(secrets, target);
  }
  const { report, snapshot } = yield* planStack(stack, secrets.filename, target.prefix);
  yield* announce(report, stack);
  yield* acceptPlan(report, confirmation);
  yield* StackRoute.apply(snapshot).pipe(
    Effect.provideService(Progress, reportProgress(stack)),
    Effect.asVoid,
  );
  yield* write({ event: "cloudflare.applied", stack: stackName(stack) });
});

const runDeployment = Effect.fn("runDeployment")(function* runDeployment(
  request: DeploymentRequest,
  secrets: DeploymentSecrets,
  target: DeploymentTarget,
) {
  const run =
    request.operation === "plan"
      ? planAll(request.stacks, secrets, target)
      : applyStack(request, secrets, target);
  yield* run.pipe(
    Effect.provideService(ArtifactWrites, true),
    Effect.provide(alchemist),
    Effect.scoped,
  );
});

export { runDeployment };
