#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { firstUserArgumentIndex, runCli } from "@repo/cli";
import { repositoryRoot } from "@repo/config/repository-root";
import {
  Confirmation,
  acceptPlan,
  alchemist,
  applyDeployment,
  causeRecord,
  deploymentAccess,
  encodeJson,
  planConfirmation,
  planDeployment,
  planReport,
  plannedStack,
  reportCause,
  deploymentState,
} from "@repo/infra-cloudflare/operator";
import { Console, Effect, Path, Schema } from "effect";

import { type OperatorAccess, operatorAccess } from "./access.ts";
import {
  type ApplyTarget,
  DeploymentEnvironment,
  type StackTarget,
  applyTarget,
  legacyTarget,
} from "./apply-target.ts";
import { gitHubToken } from "./credentials.ts";
import { approvalSubject, plannedEvent } from "./plan-event.ts";
import { matchingRepository, targetRepository, viewedRepository } from "./repository.ts";
import { moveStackState, refuseLegacyState } from "./state-migration.ts";

import type { ProgressEvent } from "alchemy/Alchemist";
import type { StateService } from "alchemy/State";

const commandRejectedEvent = "github.command_rejected";

class GitHubCommandFailure extends Schema.TaggedError<GitHubCommandFailure>()(
  "GitHubCommandFailure",
  { code: Schema.Literals(["command_invalid"]) },
) {}

const Inspection = Schema.Literals(["plan", "migrate-state"]);
const Deploy = Schema.Literal("deploy");
const ConfirmFlag = Schema.Literal("--confirm-plan");
const Repository = Schema.Literal("github");
const WikiPublisher = Schema.Literal("wiki-publisher");

const Command = Schema.Union([
  Schema.Tuple([Inspection, Repository]),
  Schema.Tuple([Inspection, WikiPublisher, DeploymentEnvironment]),
  Schema.Tuple([Deploy, Repository, ConfirmFlag, Confirmation]),
  Schema.Tuple([Deploy, WikiPublisher, DeploymentEnvironment, ConfirmFlag, Confirmation]),
]);

type ParsedCommand = typeof Command.Type;

const commandTarget = (command: ParsedCommand): ApplyTarget =>
  command[1] === "github" ? { unit: command[1] } : { environment: command[2], unit: command[1] };

const commandConfirmation = (command: ParsedCommand): string | undefined =>
  command[0] === "deploy" ? command.at(-1) : undefined;

const write = (report: Readonly<Record<string, unknown>>): Effect.Effect<void> =>
  encodeJson(report).pipe(Effect.flatMap(Console.info), Effect.orDie);

const reportProgress = (progress: ProgressEvent): Effect.Effect<void> => {
  if (progress._tag === "apply.resource.status") {
    return write({
      event: "github.resource",
      id: progress.id,
      status: progress.status,
      type: progress.type,
    });
  }
  if (progress._tag === "apply.resource.note") {
    return write({ event: "github.note", id: progress.id, message: progress.message });
  }
  return Effect.void;
};

const verifiedAccess = Effect.fn("verifiedGitHubAccess")(function* verifiedAccess() {
  const declared = yield* targetRepository;
  const address = yield* matchingRepository(declared, yield* viewedRepository(repositoryRoot));
  return yield* operatorAccess(address, yield* gitHubToken);
});

const planStack = Effect.fn("planGitHubStack")(function* planStack(
  deployment: Readonly<{ envFile: string; selection: ApplyTarget }>,
) {
  const paths = yield* Path.Path;
  const snapshot = yield* planDeployment({
    entrypoint: paths.join(repositoryRoot, "infra", deployment.selection.unit, "alchemy.run.ts"),
    envFile: deployment.envFile,
    stage: applyTarget(deployment.selection).stage,
  });
  return { planned: plannedStack(snapshot), snapshot };
});

const migrateState = Effect.fn("migrateGitHubState")(function* migrateState(
  store: StateService,
  move: Readonly<{ from: StackTarget; to: StackTarget }>,
) {
  const moved = yield* moveStackState(store, move);
  yield* write({ event: "github.state_moved", resources: moved.length, ...move.to });
});

const planOrApply = Effect.fn("planOrApplyGitHubStack")(function* planOrApply(
  deployment: Readonly<{
    access: OperatorAccess;
    confirmation: string | undefined;
    envFile: string;
    selection: ApplyTarget;
  }>,
) {
  const planning = yield* planStack(deployment);
  const plan = planReport(planning.planned);
  const subject = approvalSubject(deployment.access);
  if (deployment.confirmation === undefined) {
    const confirmation = planConfirmation(planning.planned, subject);
    return yield* write(plannedEvent(deployment.access, { confirmation, plan }));
  }
  yield* write(plannedEvent(deployment.access, { plan }));
  yield* acceptPlan(planning.planned, { confirmation: deployment.confirmation, subject });
  yield* applyDeployment(planning.snapshot, reportProgress);
  yield* write({ event: "github.applied", stack: planning.planned.stack.name });
});

runCli(
  Effect.gen(function* program() {
    const parsedCommand = yield* Schema.decodeUnknownEffect(Command)(
      process.argv.slice(firstUserArgumentIndex),
    ).pipe(Effect.mapError(() => new GitHubCommandFailure({ code: "command_invalid" })));
    const selection = commandTarget(parsedCommand);
    const { config, confidential, secrets } = yield* deploymentAccess();
    yield* Effect.gen(function* run() {
      const store = yield* deploymentState(secrets);
      const legacy = legacyTarget(selection.unit, config.prefix);
      if (parsedCommand[0] === "migrate-state") {
        return yield* migrateState(store, { from: legacy, to: applyTarget(selection) });
      }
      yield* refuseLegacyState(store, legacy);
      return yield* planOrApply({
        access: yield* verifiedAccess(),
        confirmation: commandConfirmation(parsedCommand),
        envFile: secrets.filename,
        selection,
      });
    }).pipe(
      Effect.provide(alchemist()),
      Effect.scoped,
      Effect.catchCause((cause) => reportCause(commandRejectedEvent, cause, confidential)),
    );
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord(commandRejectedEvent, cause),
);
