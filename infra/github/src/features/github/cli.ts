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

import {
  type RepositoryAddress,
  originRepository,
  repositorySlug,
  repositoryStage,
} from "./repository.ts";

import type { ProgressEvent } from "alchemy/Alchemist";

const commandRejectedEvent = "github.command_rejected";

class GitHubCommandFailure extends Schema.TaggedError<GitHubCommandFailure>()(
  "GitHubCommandFailure",
  { code: Schema.Literals(["command_invalid"]) },
) {}

const ApplyUnit = Schema.Literals(["github", "wiki-publisher"]);

const Command = Schema.Union([
  Schema.Tuple([Schema.Literal("plan"), ApplyUnit]),
  Schema.Tuple([
    Schema.Literal("deploy"),
    Schema.Literal("wiki-publisher"),
    Schema.Literal("--confirm-plan"),
    Confirmation,
  ]),
  Schema.Tuple([Schema.Literal("apply"), Schema.Literal("github")]),
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

const stackAccess = Effect.fn("githubStackAccess")(function* stackAccess(
  command: typeof Command.Type,
) {
  const address = yield* originRepository(repositoryRoot);
  if (command[0] === "apply") {
    return { address, confidential: [], stage: repositoryStage(address) } as const;
  }
  const { config, confidential, secrets } = yield* deploymentAccess();
  return {
    address,
    confidential,
    envFile: secrets.filename,
    stage: command[1] === "github" ? repositoryStage(address) : config.prefix,
  } as const;
});

const planStack = Effect.fn("planGitHubStack")(function* planStack(
  deployment: Readonly<{
    address: RepositoryAddress;
    envFile?: string;
    stage: string;
    unit: typeof ApplyUnit.Type;
  }>,
) {
  const paths = yield* Path.Path;
  const entrypoint = paths.join(repositoryRoot, "infra", deployment.unit, "alchemy.run.ts");
  const snapshot = yield* planDeployment(
    deployment.envFile === undefined
      ? { entrypoint, stage: deployment.stage }
      : { entrypoint, envFile: deployment.envFile, stage: deployment.stage },
  );
  const planned = plannedStack(snapshot);
  const slug = repositorySlug(deployment.address);
  return { confirmation: planConfirmation(planned, slug), planned, slug, snapshot };
});

runCli(
  Effect.gen(function* program() {
    const parsedCommand = yield* Schema.decodeUnknownEffect(Command)(
      process.argv.slice(firstUserArgumentIndex),
    ).pipe(Effect.mapError(() => new GitHubCommandFailure({ code: "command_invalid" })));
    const { confidential, ...access } = yield* stackAccess(parsedCommand);
    yield* Effect.gen(function* run() {
      const planning = yield* planStack({ ...access, unit: parsedCommand[1] });
      const plan = planReport(planning.planned);
      if (parsedCommand[0] === "plan") {
        yield* write({ confirmation: planning.confirmation, event: "github.planned", plan });
        return;
      }
      yield* write({ event: "github.planned", plan });
      if (parsedCommand[0] === "deploy") {
        yield* acceptPlan(planning.planned, {
          confirmation: parsedCommand[3],
          subject: planning.slug,
        });
      }
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
