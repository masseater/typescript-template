import { expect, test } from "vite-plus/test";

import { latestChecks, orphaned, parentsOf, problemOf, readyToMerge } from "./queue.ts";
import type { PullRequest } from "./queue.ts";

const FIRST = 1;
const SECOND = 2;
const THIRD = 3;
const FOURTH = 4;
const FIFTH = 5;
const MAIN = "main";
const ORDERING = { defaultBranch: MAIN, redMain: false };

const pull = (number: number, overrides: Partial<PullRequest> = {}): PullRequest => ({
  number,
  draft: false,
  branch: `branch-${String(number)}`,
  head: `head-${String(number)}`,
  base: MAIN,
  createdAt: `2026-11-27T00:00:0${String(number)}Z`,
  state: "CLEAN",
  bot: false,
  commits: [`head-${String(number)}`],
  checks: [],
  ...overrides,
});

const numbers = (pulls: readonly PullRequest[]): readonly number[] =>
  pulls.map((entry) => entry.number);

test("independent pull requests merge together in the order they were opened", () => {
  const open = [pull(THIRD), pull(FIRST), pull(SECOND)];
  expect(numbers(readyToMerge(open, ORDERING))).toStrictEqual([FIRST, SECOND, THIRD]);
});

test("a pull request that contains the head of another waits for it", () => {
  const below = pull(FIRST);
  const above = pull(SECOND, { commits: ["head-1", "head-2"] });
  expect(numbers(parentsOf(above, [below, above]))).toStrictEqual([FIRST]);
  expect(numbers(readyToMerge([below, above], ORDERING))).toStrictEqual([FIRST]);
  expect(numbers(readyToMerge([above], ORDERING))).toStrictEqual([SECOND]);
});

test("a pull request that targets the branch of another waits for it", () => {
  const below = pull(FIRST);
  const above = pull(SECOND, { base: below.branch });
  expect(numbers(readyToMerge([below, above], ORDERING))).toStrictEqual([FIRST]);
});

test("a whole chain waits one level at a time", () => {
  const first = pull(FIRST);
  const second = pull(SECOND, { base: first.branch });
  const third = pull(THIRD, { base: second.branch });
  expect(numbers(readyToMerge([first, second, third], ORDERING))).toStrictEqual([FIRST]);
  expect(numbers(readyToMerge([second, third], ORDERING))).toStrictEqual([]);
  expect(numbers(orphaned([second, third], MAIN))).toStrictEqual([SECOND]);
});

test("a draft below holds back the pull request above it", () => {
  const below = pull(FIRST, { draft: true, state: "DRAFT" });
  const above = pull(SECOND, { commits: ["head-1", "head-2"] });
  expect(numbers(readyToMerge([below, above], ORDERING))).toStrictEqual([]);
});

test("a failing pull request holds back what is stacked on it but not independent ones", () => {
  const broken = pull(FIRST, { state: "DIRTY" });
  const above = pull(SECOND, { commits: ["head-1", "head-2"] });
  const alone = pull(THIRD);
  expect(numbers(readyToMerge([broken, above, alone], ORDERING))).toStrictEqual([THIRD]);
});

test("pull requests that are not clean, drafts and other bases are left alone", () => {
  const open = [
    pull(FIRST, { state: "BLOCKED" }),
    pull(SECOND, { state: "BEHIND" }),
    pull(THIRD, { draft: true, state: "DRAFT" }),
    pull(FOURTH, { base: "release" }),
    pull(FIFTH, { state: "UNSTABLE" }),
  ];
  expect(numbers(readyToMerge(open, ORDERING))).toStrictEqual([FIFTH]);
});

test("while main is red, bot pull requests wait and the rest move", () => {
  const open = [pull(FIRST, { bot: true }), pull(SECOND)];
  expect(numbers(readyToMerge(open, { ...ORDERING, redMain: true }))).toStrictEqual([SECOND]);
  expect(numbers(readyToMerge(open, ORDERING))).toStrictEqual([FIRST, SECOND]);
});

test("two pull requests on the same head go in order of their numbers", () => {
  const first = pull(FIRST, { head: "same", commits: ["same"] });
  const second = pull(SECOND, { head: "same", commits: ["same"] });
  expect(numbers(readyToMerge([first, second], ORDERING))).toStrictEqual([FIRST]);
});

test("only the latest result of each required check counts, and a pending run wins", () => {
  const entries = [
    { name: "up-to-date", result: "FAILURE", at: "2026-11-27T00:00:01Z" },
    { name: "up-to-date", result: "SUCCESS", at: "2026-11-27T00:00:02Z" },
    { name: "other", result: "FAILURE", at: "2026-11-27T00:00:01Z" },
    { name: "verify", result: "SUCCESS", at: "2026-11-27T00:00:01Z" },
    { name: "verify", result: "PENDING", at: "2026-11-27T00:00:00Z" },
  ];
  expect(latestChecks(entries, new Set(["up-to-date", "verify"]))).toStrictEqual([
    { name: "up-to-date", result: "SUCCESS", at: "2026-11-27T00:00:02Z" },
    { name: "verify", result: "PENDING", at: "2026-11-27T00:00:00Z" },
  ]);
});

test("a conflict or a failed required check is a problem, a draft never is", () => {
  expect(problemOf(pull(FIRST, { state: "DIRTY" }), MAIN)).toContain("conflicts with `main`");
  const failed = pull(SECOND, {
    state: "BLOCKED",
    checks: [{ name: "up-to-date", result: "FAILURE", at: "" }],
  });
  expect(problemOf(failed, MAIN)).toContain("`up-to-date`");
  expect(problemOf(pull(THIRD, { draft: true, state: "DIRTY" }), MAIN)).toBeUndefined();
  expect(problemOf(pull(FOURTH), MAIN)).toBeUndefined();
});
