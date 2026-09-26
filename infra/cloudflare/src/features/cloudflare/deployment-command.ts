import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { Confirmation } from "./config.ts";
import { stackNames } from "./stacks.ts";

import type { DeploymentRequest } from "./config.ts";

const confirmPlanFlag = Flag.String("confirm-plan").pipe(
  Flag.withSchema(Confirmation),
  Flag.withDescription("Confirmation code that plan printed for the same stack"),
);

const deploymentCommand = <E, R>(
  deploy: (request: DeploymentRequest) => Effect.Effect<unknown, E, R>,
) =>
  Command.make("repo-cloudflare").pipe(
    Command.withDescription("Plans and deploys the Cloudflare stacks of the template"),
    Command.withSubcommands([
      Command.make(
        "plan",
        {
          target: Argument.Literals("stack", ["all", ...stackNames]).pipe(
            Argument.withDescription("Stack to plan, or all of them"),
          ),
        },
        ({ target }) =>
          deploy({
            operation: "plan",
            stacks: stackNames.filter((stack) => target === "all" || stack === target),
          }).pipe(Effect.asVoid),
      ).pipe(Command.withDescription("Prints each planned change and its confirmation code")),
      Command.make("deploy").pipe(
        Command.withDescription("Applies the stacks"),
        Command.withSubcommands([
          Command.make("all", {}, () =>
            deploy({ operation: "deploy-all", stacks: stackNames }).pipe(Effect.asVoid),
          ).pipe(Command.withDescription("Applies every stack in order without a confirmation")),
          ...stackNames.map((stack) =>
            Command.make(stack, { confirmation: confirmPlanFlag }, ({ confirmation }) =>
              deploy({ confirmation, operation: "deploy", stack }).pipe(Effect.asVoid),
            ).pipe(Command.withDescription(`Applies ${stack} once its plan is confirmed`)),
          ),
        ]),
      ),
    ]),
  );

export { deploymentCommand };
