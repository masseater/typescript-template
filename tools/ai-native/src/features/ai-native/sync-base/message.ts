export type BehindPullRequest = {
  readonly baseRefName: string;
  readonly number: number;
  readonly url: string;
};

export const instructionFor = (pullRequest: BehindPullRequest): string =>
  [
    `sync-base: pull request #${String(pullRequest.number)} is behind its base branch \`${pullRequest.baseRefName}\`.`,
    "The base moved ahead of this head. Bring the latest base into this branch before you continue:",
    `- fetch the base (\`git fetch origin ${pullRequest.baseRefName}\`) and rebase or merge onto it`,
    "- or run `mergify stack sync` when this pull request is part of a stack",
    "Do not push while behind, and do not leave a conflicting or outdated head queued to merge.",
    pullRequest.url,
  ].join("\n");
