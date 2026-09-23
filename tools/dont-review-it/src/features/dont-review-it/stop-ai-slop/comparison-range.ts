import { Effect } from "effect";

import { runGitText } from "./git-text.ts";

export type ComparisonRange = Readonly<{
  baseRevision: string;
  headRevision: string;
}>;

const INTEGRATION_REVISION = "origin/main";

const trimmedGitText = (repositoryRoot: string, args: readonly string[]) =>
  Effect.map(runGitText({ repositoryRoot, args }), (answered) => answered.trim());

const commitOrNull = (repositoryRoot: string, revision: string) =>
  Effect.map(
    trimmedGitText(repositoryRoot, [
      "rev-list",
      "--max-count=1",
      "--ignore-missing",
      "--end-of-options",
      revision,
    ]),
    (found) => (found === "" ? null : found),
  );

const mergeBaseOf = (repositoryRoot: string, revisions: readonly [string, string]) =>
  trimmedGitText(repositoryRoot, ["merge-base", ...revisions]);

const indexTreeOf = (repositoryRoot: string) => trimmedGitText(repositoryRoot, ["write-tree"]);

export const comparisonRangeIn = Effect.fn("comparisonRangeIn")(function* comparisonRangeIn(
  repositoryRoot: string,
) {
  const mergeHead = yield* commitOrNull(repositoryRoot, "MERGE_HEAD");
  if (mergeHead !== null) {
    const range: ComparisonRange = {
      baseRevision: yield* mergeBaseOf(repositoryRoot, ["HEAD", mergeHead]),
      headRevision: yield* indexTreeOf(repositoryRoot),
    };
    return range;
  }

  const integration = yield* commitOrNull(repositoryRoot, INTEGRATION_REVISION);
  if (integration === null) return null;

  const range: ComparisonRange = {
    baseRevision: yield* mergeBaseOf(repositoryRoot, [integration, "HEAD"]),
    headRevision: "HEAD",
  };
  return range;
});
