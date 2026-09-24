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
} from "@repo/infra-cloudflare/operator";
import { Console, Effect, Path, Schema } from "effect";

import { originRepository, repositorySlug } from "./repository.ts";

import type { ProgressEvent } from "alchemy/Alchemist";

const commandRejectedEvent = "github.command_rejected";
const entrypoint = new URL("../../../alchemy.run.ts", import.meta.url);

class GitHubCommandFailure extends Schema.TaggedError<GitHubCommandFailure>()(
  "GitHubCommandFailure",
  { code: Schema.Literals(["command_invalid"]) },
) {}

const Command = Schema.Union([
  Schema.Tuple([Schema.Literal("plan")]),
  Schema.Tuple([Schema.Literal("deploy"), Schema.Literal("--confirm-plan"), Confirmation]),
]);

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

const planRuleset = Effect.fn("planRuleset")(function* planRuleset(
  deployment: Readonly<{ envFile: string; stage: string }>,
) {
  const paths = yield* Path.Path;
  const snapshot = yield* planDeployment({
    entrypoint: yield* paths.fromFileUrl(entrypoint),
    envFile: deployment.envFile,
    stage: deployment.stage,
  });
  const address = yield* originRepository(repositoryRoot);
  const planned = plannedStack(snapshot);
  const slug = repositorySlug(address);
  return { confirmation: planConfirmation(planned, slug), planned, slug, snapshot };
});

runCli(
  Effect.gen(function* program() {
    const parsedCommand = yield* Schema.decodeUnknownEffect(Command)(
      process.argv.slice(firstUserArgumentIndex),
    ).pipe(Effect.mapError(() => new GitHubCommandFailure({ code: "command_invalid" })));
    const { config, confidential, secrets } = yield* deploymentAccess();
    yield* Effect.gen(function* run() {
      const planning = yield* planRuleset({ envFile: secrets.filename, stage: config.prefix });
      const plan = planReport(planning.planned);
      if (parsedCommand[0] === "plan") {
        yield* write({ confirmation: planning.confirmation, event: "github.planned", plan });
        return;
      }
      yield* write({ event: "github.planned", plan });
      yield* acceptPlan(planning.planned, {
        confirmation: parsedCommand[2],
        subject: planning.slug,
      });
      yield* applyDeployment(planning.snapshot, reportProgress);
      yield* write({ event: "github.applied", stack: planning.planned.stack.name });
    }).pipe(
      Effect.provide(alchemist()),
      Effect.scoped,
      Effect.catchCause((cause) => reportCause(commandRejectedEvent, cause, confidential)),
    );
  }).pipe(Effect.provide(NodeServices.layer)),
  (cause) => causeRecord(commandRejectedEvent, cause),
);
