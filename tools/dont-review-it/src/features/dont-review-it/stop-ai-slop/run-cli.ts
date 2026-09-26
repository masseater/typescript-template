import { Config, Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import {
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  type CliResult,
} from "../repository-checks/index.ts";
import { SourceUnparsable } from "./checks/verification-source.ts";
import { failingWhenThrown } from "./expected-throw.ts";
import { gitEnvironmentLayer } from "./git-text.ts";
import { gitHubApiFor, type GitHubRequestFailed } from "./github-request.ts";
import { formatProblem, type SlopProblem } from "./problem.ts";
import { resolvedComparison, type ComparisonUnresolved } from "./resolved-comparison.ts";
import { runChecks } from "./run-checks.ts";

import type { BlobUnreadable } from "./blob-unreadable.ts";
import type { GitCommandFailed } from "./git-command-failed.ts";
import type { GitHubAnswerUnexpected } from "./github-answer-unexpected.ts";
import type { GitHubComparisonIncomplete } from "./github-comparison.ts";
import type { UndecodableSource } from "./repository-comparison.ts";
import type { DiffUnreadable } from "./repository-diff.ts";

export type StopAiSlopOptions = Readonly<{
  repositoryRoot: string;
}>;

const gitHubApiFromEnvironment = Effect.flatMap(
  Config.option(Config.Redacted("GITHUB_TOKEN")),
  Option.match({
    onNone: () => Effect.succeed(null),
    onSome: gitHubApiFor,
  }),
);

const checkedProblems = Effect.fn("checkedProblems")(function* checkedProblems({
  repositoryRoot,
}: StopAiSlopOptions) {
  const comparison = yield* resolvedComparison(repositoryRoot, {
    repository: Option.getOrUndefined(yield* Config.option(Config.String("GITHUB_REPOSITORY"))),
    api: yield* gitHubApiFromEnvironment,
  });
  return yield* failingWhenThrown(() => runChecks({ comparison }), Schema.is(SourceUnparsable));
});

const reported = (problems: readonly SlopProblem[]): CliResult => ({
  exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
  out: problems.map((problem) => `${formatProblem(problem)}\n`).join(""),
  error: "",
});

type Refusal =
  | Config.ConfigError
  | GitCommandFailed
  | ComparisonUnresolved
  | GitHubRequestFailed
  | GitHubAnswerUnexpected
  | GitHubComparisonIncomplete
  | DiffUnreadable
  | BlobUnreadable
  | UndecodableSource
  | SourceUnparsable;

const refused = (failure: Refusal): CliResult => ({
  exitCode: EXIT_MISUSE,
  out: "",
  error: `${failure.message}\n`,
});

export const stopAiSlop = (options: StopAiSlopOptions) =>
  checkedProblems(options).pipe(
    Effect.provide(Layer.merge(gitEnvironmentLayer, FetchHttpClient.layer)),
    Effect.match({ onFailure: refused, onSuccess: reported }),
  );
