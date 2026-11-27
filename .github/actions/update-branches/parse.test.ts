import { expect, test } from "vite-plus/test";

import { parsePull } from "./parse.ts";

const REQUIRED = new Set(["up-to-date"]);
const NUMBER = 1574;

const LISTED = {
  number: NUMBER,
  isDraft: false,
  headRefName: "feature",
  headRefOid: "bbb",
  baseRefName: "main",
  createdAt: "2026-11-27T00:00:00Z",
  mergeStateStatus: "CLEAN",
  author: { is_bot: true, login: "renovate" },
  commits: [{ oid: "aaa" }, { oid: "bbb" }],
  statusCheckRollup: [
    {
      __typename: "CheckRun",
      name: "up-to-date",
      status: "COMPLETED",
      conclusion: "SUCCESS",
      startedAt: "2026-11-27T00:00:01Z",
    },
    {
      __typename: "CheckRun",
      name: "verify",
      status: "IN_PROGRESS",
      conclusion: "",
      startedAt: "2026-11-27T00:00:02Z",
    },
    { __typename: "StatusContext", context: "ci/other", state: "FAILURE", createdAt: "" },
  ],
};

test("a listed pull request becomes the queue's view of it", () => {
  expect(parsePull(LISTED, REQUIRED)).toStrictEqual({
    number: NUMBER,
    draft: false,
    branch: "feature",
    head: "bbb",
    base: "main",
    createdAt: "2026-11-27T00:00:00Z",
    state: "CLEAN",
    bot: true,
    commits: ["aaa", "bbb"],
    checks: [{ name: "up-to-date", result: "SUCCESS", at: "2026-11-27T00:00:01Z" }],
  });
});

test("a check that has not completed counts as pending, and unrequired ones are dropped", () => {
  const both = parsePull(LISTED, new Set(["up-to-date", "verify", "ci/other"]));
  expect(both.checks.map((check) => `${check.name}=${check.result}`)).toStrictEqual([
    "up-to-date=SUCCESS",
    "verify=PENDING",
    "ci/other=FAILURE",
  ]);
});

test("a pull request with no author flag, commits or checks still parses", () => {
  const bare = parsePull({ ...LISTED, author: {}, commits: [], statusCheckRollup: [] }, REQUIRED);
  expect(bare.bot).toBe(false);
  expect(bare.commits).toStrictEqual([]);
  expect(bare.checks).toStrictEqual([]);
});
