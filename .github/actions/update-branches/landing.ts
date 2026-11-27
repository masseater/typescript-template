import { setTimeout as sleep } from "node:timers/promises";

import { defaultBranch, gh, repository } from "./context.ts";
import { orphaned } from "./queue.ts";
import type { PullRequest } from "./queue.ts";

const MERGE_ATTEMPTS = 4;
const RETRY_DELAY_MS = 5000;
const NONE = 0;
const ONE = 1;

const label = (pull: PullRequest): string => `#${String(pull.number)}`;

const marker = (pull: PullRequest, kind: string): string =>
  `<!-- update-branches:${kind}:${pull.head} -->`;

const kindOf = (pull: PullRequest): string => {
  if (pull.state === "DIRTY") {
    return "DIRTY";
  }
  return "FAILED";
};

export const report = (pull: PullRequest, reason: string): void => {
  const mark = marker(pull, kindOf(pull));
  try {
    const bodies = gh([
      "api",
      "--paginate",
      `repos/${repository}/issues/${String(pull.number)}/comments`,
      "--jq",
      ".[].body",
    ]);
    if (bodies.some((body) => body.includes(mark))) {
      return;
    }
    gh([
      "pr",
      "comment",
      String(pull.number),
      "--repo",
      repository,
      "--body",
      `${mark}\nThe merge queue skips this pull request because ${reason}. Every pull request that is not a draft joins the queue by itself, so nothing needs turning on: fix it on this branch and push, and the queue merges it on its own. Make it a draft to keep it out of the queue.`,
    ]);
    console.log(`::warning::${label(pull)} is skipped: ${reason}`);
  } catch {
    console.log(`::warning::Could not report on pull request ${label(pull)}`);
  }
};

const wasMerged = (branch: string): boolean => {
  const [found] = gh([
    "pr",
    "list",
    "--repo",
    repository,
    "--state",
    "merged",
    "--head",
    branch,
    "--json",
    "number",
    "--jq",
    ".[0].number",
  ]);
  return found !== undefined && found !== "null";
};

export const retarget = (open: readonly PullRequest[]): number =>
  orphaned(open, defaultBranch).filter((pull) => {
    if (!wasMerged(pull.base)) {
      return false;
    }
    gh(["pr", "edit", String(pull.number), "--repo", repository, "--base", defaultBranch]);
    console.log(`Retargeted ${label(pull)} from merged \`${pull.base}\` to \`${defaultBranch}\``);
    return true;
  }).length;

const mergeOnce = (pull: PullRequest): boolean => {
  try {
    gh([
      "pr",
      "merge",
      String(pull.number),
      "--repo",
      repository,
      "--squash",
      "--match-head-commit",
      pull.head,
    ]);
    return true;
  } catch {
    return false;
  }
};

const conflicting = (pull: PullRequest): boolean => {
  const [state] = gh([
    "pr",
    "view",
    String(pull.number),
    "--repo",
    repository,
    "--json",
    "mergeStateStatus",
    "--jq",
    ".mergeStateStatus",
  ]);
  return state === "DIRTY";
};

const merge = async (pull: PullRequest, attempt = ONE): Promise<boolean> => {
  if (mergeOnce(pull)) {
    console.log(`Merged ${label(pull)}`);
    return true;
  }
  if (attempt >= MERGE_ATTEMPTS || conflicting(pull)) {
    console.log(`::warning::Could not merge ${label(pull)}`);
    return false;
  }
  await sleep(RETRY_DELAY_MS);
  return merge(pull, attempt + ONE);
};

export const mergeAll = async (ready: readonly PullRequest[]): Promise<number> => {
  const [next, ...rest] = ready;
  if (next === undefined) {
    return NONE;
  }
  const landed = await merge(next);
  const others = await mergeAll(rest);
  return others + Number(landed);
};
