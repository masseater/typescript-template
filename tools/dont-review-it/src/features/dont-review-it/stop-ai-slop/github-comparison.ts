import { Effect } from "effect";

import { comparisonFrom, type RepositoryComparison } from "./repository-comparison.ts";

import type { ComparedFile, GitHubApi } from "./github-request.ts";

export type GitHubPullRequestComparison = Readonly<{
  repositoryRoot: string;
  repository: string;
  baseRevision: string;
  headRevision: string;
  api: GitHubApi;
}>;

const CONTENTS_CONCURRENCY = 8;

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
    const { merge_base_commit: mergeBase, files = [] } = yield* api.compare(repository, {
      base: baseRevision,
      head: headRevision,
    });
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
