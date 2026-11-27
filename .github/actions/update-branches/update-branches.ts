import { defaultBranch, requiredChecks } from "./context.ts";
import { mergeAll, report, retarget } from "./landing.ts";
import { redVerify, verifyName } from "./main-state.ts";
import { listOpen } from "./pulls.ts";
import { isMergeable, parentsOf, problemOf, readyToMerge } from "./queue.ts";
import type { PullRequest } from "./queue.ts";

const UNKNOWN_RETRIES = 6;
const MAX_ROUNDS = 10;
const NONE = 0;
const ONE = 1;

interface Queue {
  readonly required: ReadonlySet<string>;
  readonly red: string | undefined;
}

const reportProblems = (open: readonly PullRequest[]): void => {
  for (const pull of open) {
    const reason = problemOf(pull, defaultBranch);
    if (reason !== undefined) {
      report(pull, reason);
    }
  }
};

const summarize = (open: readonly PullRequest[]): void => {
  const live = open.filter((pull) => !pull.draft);
  const stacked = live.filter((pull) => parentsOf(pull, open).length > NONE);
  const blocked = live.filter((pull) => !isMergeable(pull));
  console.log(
    `Nothing left to merge; ${String(stacked.length)} wait for a pull request below them, ${String(blocked.length)} wait for checks or a fix`,
  );
};

const land = async (open: readonly PullRequest[], redMain: boolean): Promise<number> => {
  reportProblems(open);
  const landed = await mergeAll(readyToMerge(open, { defaultBranch, redMain }));
  if (landed === NONE) {
    summarize(open);
  }
  return landed;
};

const settle = async (state: Queue, round: number, merged: number): Promise<number> => {
  if (round > MAX_ROUNDS) {
    return merged;
  }
  const open = await listOpen(state.required, UNKNOWN_RETRIES);
  if (retarget(open) > NONE) {
    return settle(state, round + ONE, merged);
  }
  const landed = await land(open, state.red !== undefined);
  if (landed === NONE) {
    return merged;
  }
  return settle(state, round + ONE, merged + landed);
};

const state: Queue = { required: requiredChecks(), red: redVerify() };
if (state.red !== undefined) {
  console.log(
    `::warning::${verifyName} is red on ${defaultBranch} (${state.red}); bot pull requests wait until it passes`,
  );
}
console.log(`Merged ${String(await settle(state, ONE, NONE))} pull request(s)`);
