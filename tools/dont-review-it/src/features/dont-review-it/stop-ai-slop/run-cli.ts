import { NodeServices } from "@effect/platform-node";
import { Config, Effect, Layer, Option, Path, Schema } from "effect";

import {
  createCliRunner,
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  type CliResult,
} from "../repository-checks/index.ts";
import { type ComparisonRange } from "./comparison-range.ts";
import { gitEnvironmentLayer } from "./git-text.ts";
import { githubRequestFor } from "./github-request.ts";
import { parsingRefused } from "./parsing-refused.ts";
import { formatProblem } from "./problem.ts";
import { compareRevisions, type RepositoryComparison } from "./repository-comparison.ts";
import { ComparisonUnresolved, resolvedComparison } from "./resolved-comparison.ts";
import { runChecks } from "./run-checks.ts";

const USAGE = `Usage: stop-ai-slop check [--base <revision> --head <revision>] [--repository-root <path>]

Commands:
  check   Run every registered check in definition order.

Options:
  --base <revision>         Git revision before the change. Requires --head.
  --head <revision>         Git revision after the change. Requires --base.
  --repository-root <path>  Root of the Git repository. Defaults to the current working directory.

Without --base and --head the change on its way into the integration branch is compared:
the staged merge result when a merge is in progress, and the history since it left
origin/main otherwise.
`;

const misuse = (): CliResult => ({ exitCode: EXIT_MISUSE, out: "", error: USAGE });

const OPTION_NAMES = ["base", "head", "repository-root"] as const;

type OptionName = (typeof OPTION_NAMES)[number];

type ParsedArguments = Readonly<{
  positionals: readonly string[];
  values: Readonly<Partial<Record<OptionName, string>>>;
}>;

const OPTION_PREFIX = "--";

const optionNamed = (spelled: string): OptionName | null =>
  OPTION_NAMES.find((declared) => declared === spelled) ?? null;

const looksLikeOption = (held: string): boolean => held.length > 1 && held.startsWith("-");

const withPositionals = (
  parsed: ParsedArguments,
  positionals: readonly string[],
): ParsedArguments => ({ ...parsed, positionals: [...parsed.positionals, ...positionals] });

const withValue = (parsed: ParsedArguments, name: OptionName, value: string): ParsedArguments => ({
  ...parsed,
  values: { ...parsed.values, [name]: value },
});

const parsedFrom = (
  remaining: readonly string[],
  parsed: ParsedArguments,
): ParsedArguments | null => {
  const [current, ...rest] = remaining;
  if (current === undefined) return parsed;
  if (current === OPTION_PREFIX) return withPositionals(parsed, rest);
  if (!looksLikeOption(current)) return parsedFrom(rest, withPositionals(parsed, [current]));
  if (!current.startsWith(OPTION_PREFIX)) return null;

  const separator = current.indexOf("=");
  const name = optionNamed(
    current.slice(OPTION_PREFIX.length, separator === -1 ? undefined : separator),
  );
  if (name === null) return null;
  if (separator !== -1) {
    return parsedFrom(rest, withValue(parsed, name, current.slice(separator + 1)));
  }

  const [value, ...afterValue] = rest;
  if (value === undefined || looksLikeOption(value)) return null;
  return parsedFrom(afterValue, withValue(parsed, name, value));
};

const parsedArguments = (argv: readonly string[]): ParsedArguments | null =>
  parsedFrom(argv, { positionals: [], values: {} });

const namedRange = (base: string | undefined, head: string | undefined): ComparisonRange | null =>
  base === undefined || base === "" || head === undefined || head === ""
    ? null
    : { baseRevision: base, headRevision: head };

const reportedComparison = (comparison: RepositoryComparison) =>
  Effect.try({
    try: (): CliResult => {
      const problems = runChecks({ comparison });
      return {
        exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
        out: problems.map((problem) => `${formatProblem(problem)}\n`).join(""),
        error: "",
      };
    },
    catch: parsingRefused,
  });

const optionalSetting = <A>(setting: Config.Config<A>) =>
  Effect.map(Config.option(setting), Option.getOrUndefined);

const comparisonFor = Effect.fn("comparisonFor")(function* comparisonFor(
  repositoryRoot: string,
  named: ComparisonRange | null,
) {
  if (named !== null) return yield* compareRevisions({ repositoryRoot, ...named });
  return yield* resolvedComparison(repositoryRoot, {
    repository: yield* optionalSetting(Config.String("GITHUB_REPOSITORY")),
    request: githubRequestFor(yield* optionalSetting(Config.Redacted("GITHUB_TOKEN"))),
  });
});

const stopAiSlop = Effect.fn("stopAiSlop")(function* stopAiSlop(argv: readonly string[]) {
  const parsed = parsedArguments(argv);
  if (parsed === null) return misuse();
  if (parsed.positionals.length !== 1 || parsed.positionals[0] !== "check") return misuse();

  const { base, head } = parsed.values;
  const named = namedRange(base, head);
  if (named === null && (base !== undefined || head !== undefined)) return misuse();

  const paths = yield* Path.Path;
  const repositoryRoot = paths.resolve(parsed.values["repository-root"] ?? process.cwd());
  return yield* reportedComparison(yield* comparisonFor(repositoryRoot, named));
});

const unresolvedMisuse = (refusal: ComparisonUnresolved): CliResult => ({
  exitCode: EXIT_MISUSE,
  out: "",
  error: `${refusal.message}\n`,
});

const dispatch = (argv: readonly string[]): Promise<CliResult> =>
  Effect.runPromise(
    stopAiSlop(argv).pipe(
      Effect.catchIf(Schema.is(ComparisonUnresolved), (refusal) =>
        Effect.succeed(unresolvedMisuse(refusal)),
      ),
      Effect.provide(Layer.merge(NodeServices.layer, gitEnvironmentLayer)),
    ),
  );

export const runStopAiSlop = createCliRunner(dispatch);
