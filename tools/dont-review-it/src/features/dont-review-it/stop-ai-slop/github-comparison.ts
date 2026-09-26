import { Effect, Schema } from "effect";

import { comparisonFrom, type RepositoryComparison } from "./repository-comparison.ts";

import type { ComparedFile, GitHubApi } from "./github-request.ts";

type GitHubPullRequestComparison = Readonly<{
  repositoryRoot: string;
  repository: string;
  baseRevision: string;
  headRevision: string;
  api: GitHubApi;
}>;

export class GitHubComparisonIncomplete extends Schema.TaggedError<GitHubComparisonIncomplete>()(
  "GitHubComparisonIncomplete",
  { message: Schema.String },
) {}

const CONTENTS_CONCURRENCY = 8;

const COMPARE_FILE_LIMIT = 300;

const completeFilesOf = (
  files: readonly ComparedFile[] | undefined,
): Effect.Effect<readonly ComparedFile[], GitHubComparisonIncomplete> => {
  if (files === undefined) {
    return Effect.fail(
      GitHubComparisonIncomplete.make({
        message:
          "Do not pass a change the GitHub compare answered without its changed files: fetch the merge with its parents so the checkout compares it locally.",
      }),
    );
  }
  if (files.length >= COMPARE_FILE_LIMIT) {
    return Effect.fail(
      GitHubComparisonIncomplete.make({
        message: `Do not pass a change the GitHub compare may have cut short: it lists at most ${COMPARE_FILE_LIMIT} files and answered ${files.length}. Fetch the merge with its parents so the checkout compares it locally.`,
      }),
    );
  }
  const unpatched = files.filter((file) => file.patch === undefined && file.changes > 0);
  if (unpatched.length > 0) {
    return Effect.fail(
      GitHubComparisonIncomplete.make({
        message: `Do not pass a change whose diff the GitHub compare left out: ${unpatched.map((file) => file.filename).join(", ")}. Fetch the merge with its parents so the checkout compares it locally.`,
      }),
    );
  }
  return Effect.succeed(files);
};

const formerPathOf = (file: ComparedFile): string =>
  file.status === "renamed" ? file.previous_filename : file.filename;

const inventoryOf = (file: ComparedFile): string => {
  switch (file.status) {
    case "added":
    case "copied":
      return `A\0${file.filename}\0`;
    case "changed":
    case "modified":
      return `M\0${file.filename}\0`;
    case "removed":
      return `D\0${file.filename}\0`;
    case "renamed":
      return `R100\0${file.previous_filename}\0${file.filename}\0`;
  }
};

const headersOf = (file: ComparedFile): readonly string[] => {
  switch (file.status) {
    case "added":
    case "copied":
      return ["new file mode 100644", "--- /dev/null", `+++ b/${file.filename}`];
    case "changed":
    case "modified":
      return [`--- a/${file.filename}`, `+++ b/${file.filename}`];
    case "removed":
      return ["deleted file mode 100644", `--- a/${file.filename}`, "+++ /dev/null"];
    case "renamed":
      return [
        "similarity index 100%",
        `rename from ${file.previous_filename}`,
        `rename to ${file.filename}`,
      ];
  }
};

const patchEntryOf = (file: ComparedFile): string => {
  const lines = [
    `diff --git a/${formerPathOf(file)} b/${file.filename}`,
    ...headersOf(file),
    ...(file.patch === undefined ? [] : [file.patch.replace(/\n+$/u, "")]),
  ];
  return `${lines.join("\n")}\n`;
};

export const compareGitHubPullRequest = Effect.fn("compareGitHubPullRequest")(
  function* compareGitHubPullRequest({
    repositoryRoot,
    repository,
    baseRevision,
    headRevision,
    api,
  }: GitHubPullRequestComparison) {
    const { merge_base_commit: mergeBase, files: answeredFiles } = yield* api.compare(repository, {
      base: baseRevision,
      head: headRevision,
    });
    const files = yield* completeFilesOf(answeredFiles);
    const comparison: RepositoryComparison = {
      repositoryRoot,
      baseRevision: mergeBase.sha,
      headRevision,
      files: yield* comparisonFrom({
        inventoryOutput: files.map(inventoryOf).join(""),
        diff: files.map(patchEntryOf).join(""),
        readSources: (requests) =>
          Effect.forEach(
            requests,
            ({ side, sourcePath }) =>
              api.contents(repository, {
                sourcePath,
                revision: side === "base" ? mergeBase.sha : headRevision,
              }),
            { concurrency: CONTENTS_CONCURRENCY },
          ),
      }),
    };
    return comparison;
  },
);
