import type { DeploymentRequest, DeploymentTarget } from "./config.ts";
import { Progress, Stack as StackRoute, layer } from "alchemy/Alchemist";
import { acceptPlan, planConfirmation, planReport, plannedStack } from "./plan-confirmation.ts";
import type { ArtifactMode } from "./artifacts.ts";
import { ArtifactWrites } from "./artifacts.ts";
import type { DeploymentSecrets } from "./credentials.ts";
import { Effect } from "effect";
import type { PlannedStack } from "./plan-confirmation.ts";
import type { ProgressEvent } from "alchemy/Alchemist";
import type { StackName } from "./stacks.ts";
import { assertDatabaseUnclaimed } from "./database-guard.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { stateStore } from "./deployment-access.ts";

interface Deployment {
  readonly access: { readonly accountId: string; readonly apiToken: string };
  readonly secrets: DeploymentSecrets;
  readonly target: DeploymentTarget;
}

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
  deployment: Deployment,
) {
  const snapshot = yield* StackRoute.plan({
    operation: "deploy",
    target: {
      entrypoint: fileURLToPath(new URL(`${stack}.ts`, import.meta.url)),
      envFile: deployment.secrets.filename,
      stage: deployment.target.prefix,
    },
  });
  return { planned: plannedStack(snapshot), snapshot };
});

function announce(
  planned: PlannedStack,
  stack: StackName,
  confirmation?: string,
): Effect.Effect<void> {
  return write({
    ...(confirmation === undefined ? {} : { confirmation }),
    event: "cloudflare.planned",
    plan: planReport(planned),
    stack,
  });
}

const previewStack = Effect.fn("previewStack")(function* previewStack(
  stack: StackName,
  deployment: Deployment,
) {
  const { planned } = yield* planStack(stack, deployment);
  yield* announce(planned, stack, planConfirmation(planned, deployment.access.accountId));
});

const previewStacks = Effect.fn("previewStacks")(function* previewStacks(
  stacks: readonly StackName[],
  deployment: Deployment,
) {
  for (const stack of stacks) {
    yield* previewStack(stack, deployment).pipe(
      Effect.tapCause(() => write({ event: "cloudflare.plan_failed", stack })),
    );
  }
});

const applyStack = Effect.fn("applyStack")(function* applyStack(
  requested: { readonly confirmation: string; readonly stack: StackName },
  deployment: Deployment,
) {
  const { confirmation, stack } = requested;
  if (stack === "database") {
    yield* assertDatabaseUnclaimed(
      deployment.access,
      deployment.target,
      stateStore(deployment.secrets),
    );
  }
  const { planned, snapshot } = yield* planStack(stack, deployment);
  yield* announce(planned, stack);
  yield* acceptPlan(planned, { accountId: deployment.access.accountId, confirmation });
  yield* StackRoute.apply(snapshot).pipe(
    Effect.provideService(Progress, reportProgress(stack)),
    Effect.asVoid,
  );
  yield* write({ event: "cloudflare.applied", stack });
});

const runDeployment = Effect.fn("runDeployment")(function* runDeployment(
  request: DeploymentRequest,
  deployment: Deployment,
) {
  const mode: ArtifactMode = request.operation === "plan" ? "stage" : "publish";
  const run =
    request.operation === "plan"
      ? previewStacks(request.stacks, deployment)
      : applyStack(request, deployment);
  yield* run.pipe(
    Effect.provideService(ArtifactWrites, mode),
    Effect.provide(alchemist),
    Effect.scoped,
  );
});

export { runDeployment };
export type { Deployment };
