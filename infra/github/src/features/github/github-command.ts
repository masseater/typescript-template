import { Confirmation } from "@repo/infra-cloudflare/operator";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

const applyUnits = ["github", "wiki-publisher"] as const;
type ApplyUnit = (typeof applyUnits)[number];

type GitHubRequest =
  | { readonly operation: "plan"; readonly unit: ApplyUnit }
  | { readonly operation: "deploy"; readonly unit: ApplyUnit; readonly confirmation: string };

const unitArgument = Argument.Literals("unit", applyUnits).pipe(
  Argument.withDescription("Alchemy stack under infra/ to plan or apply"),
);

const githubCommand = <E, R>(apply: (request: GitHubRequest) => Effect.Effect<unknown, E, R>) =>
  Command.make("repo-github").pipe(
    Command.withDescription("Plans and applies the GitHub stacks with the local GitHub CLI login"),
    Command.withSubcommands([
      Command.make("plan", { unit: unitArgument }, ({ unit }) =>
        apply({ operation: "plan", unit }).pipe(Effect.asVoid),
      ).pipe(Command.withDescription("Prints the planned changes and their confirmation code")),
      Command.make(
        "deploy",
        {
          confirmation: Flag.String("confirm-plan").pipe(
            Flag.withSchema(Confirmation),
            Flag.withDescription("Confirmation code that plan printed for the same unit"),
          ),
          unit: unitArgument,
        },
        ({ confirmation, unit }) =>
          apply({ confirmation, operation: "deploy", unit }).pipe(Effect.asVoid),
      ).pipe(Command.withDescription("Applies the unit once its plan is confirmed")),
    ]),
  );

export { githubCommand };
export type { ApplyUnit, GitHubRequest };
