#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { runCli, runCommand } from "@repo/cli";
import { repositoryRoot } from "@repo/config/repository-root";
import {
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
} from "@repo/infra-cloudflare/operator";
import { Console, Effect, Path } from "effect";

import { githubCommand } from "./github-command.ts";
import { originRepository, repositorySlug } from "./repository.ts";

import type { ProgressEvent } from "alchemy/Alchemist";
import type { ApplyUnit, GitHubRequest } from "./github-command.ts";

const commandRejectedEvent = "github.command_rejected";

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

const planStack = Effect.fn("planGitHubStack")(function* planStack(
  deployment: Readonly<{ envFile: string; stage: string; unit: ApplyUnit }>,
) {
  const paths = yield* Path.Path;
  const snapshot = yield* planDeployment({
    entrypoint: paths.join(repositoryRoot, "infra", deployment.unit, "alchemy.run.ts"),
    envFile: deployment.envFile,
    stage: deployment.stage,
  });
  const address = yield* originRepository(repositoryRoot);
  const planned = plannedStack(snapshot);
  const slug = repositorySlug(address);
  return { confirmation: planConfirmation(planned, slug), planned, slug, snapshot };
});

const run = (request: GitHubRequest) =>
  Effect.gen(function* program() {
    const { config, confidential, secrets } = yield* deploymentAccess();
    yield* Effect.gen(function* apply() {
      const planning = yield* planStack({
        envFile: secrets.filename,
        stage: config.prefix,
        unit: request.unit,
      });
      const plan = planReport(planning.planned);
      if (request.operation === "plan") {
        yield* write({ confirmation: planning.confirmation, event: "github.planned", plan });
        return;
      }
      yield* write({ event: "github.planned", plan });
      yield* acceptPlan(planning.planned, {
        confirmation: request.confirmation,
        subject: planning.slug,
      });
      yield* applyDeployment(planning.snapshot, reportProgress);
      yield* write({ event: "github.applied", stack: planning.planned.stack.name });
    }).pipe(
      Effect.provide(alchemist()),
      Effect.scoped,
      Effect.catchCause((cause) => reportCause(commandRejectedEvent, cause, confidential)),
    );
  });

runCli(
  githubCommand(run).pipe(runCommand({ version: "0.0.0" }), Effect.provide(NodeServices.layer)),
  (cause) => causeRecord(commandRejectedEvent, cause),
);
