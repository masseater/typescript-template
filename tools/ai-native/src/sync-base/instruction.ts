import { instructionFor, type BehindPullRequest } from "./message.ts";
import { type OpenPullRequest } from "./parse-open-pr.ts";

const behindPullRequestOf = (pullRequest: OpenPullRequest): BehindPullRequest | undefined =>
  pullRequest.mergeStateStatus === "BEHIND"
    ? {
        baseRefName: pullRequest.baseRefName,
        number: pullRequest.number,
        url: pullRequest.url,
      }
    : undefined;

export const instructionOf = (pullRequest: OpenPullRequest | undefined): string | undefined => {
  const behind = pullRequest === undefined ? undefined : behindPullRequestOf(pullRequest);
  return behind === undefined ? undefined : instructionFor(behind);
};
