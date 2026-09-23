import { Effect, Schema } from "effect";

import { comparisonRangeIn } from "./comparison-range.ts";
import { runGitText } from "./git-text.ts";
import { compareGitHubPullRequest } from "./github-comparison.ts";
import { compareRevisions } from "./repository-comparison.ts";

import type { GitHubApi } from "./github-request.ts";

const PARENT_PREFIX = "parent ";

export class ComparisonUnresolved extends Schema.TaggedError<ComparisonUnresolved>()(
  "ComparisonUnresolved",
  { message: Schema.String },
) {}

const parentsOf = (repositoryRoot: string) =>
  Effect.map(runGitText({ repositoryRoot, args: ["cat-file", "commit", "HEAD"] }), (commit) =>
    commit
      .split("\n")
      .filter((line) => line.startsWith(PARENT_PREFIX))
      .map((line) => line.slice(PARENT_PREFIX.length)),
  );

export type ComparisonEnvironment = Readonly<{
  repository: string | undefined;
  api: GitHubApi | null;
}>;

export const resolvedComparison = Effect.fn("resolvedComparison")(function* resolvedComparison(
  repositoryRoot: string,
  environment: ComparisonEnvironment,
) {
  const range = yield* comparisonRangeIn(repositoryRoot);
  if (range !== null) return yield* compareRevisions({ repositoryRoot, ...range });

  const [base, head] = yield* parentsOf(repositoryRoot);
  const { repository, api } = environment;
  if (repository === undefined || api === null || base === undefined || head === undefined) {
    return yield* new ComparisonUnresolved({
      message:
        "Do not leave the compared change to guesswork: this checkout holds neither origin/main nor a pull request merge to read. Fetch the integration branch before checking.",
    });
  }

  return yield* compareGitHubPullRequest({
    repositoryRoot,
    repository,
    baseRevision: base,
    headRevision: head,
    api,
  });
});
