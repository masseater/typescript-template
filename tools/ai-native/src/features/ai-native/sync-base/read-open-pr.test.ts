import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { openPullRequestOf } from "./read-open-pr.ts";

describe("openPullRequestOf", () => {
  describe("a successful gh pr view of an open pull request", () => {
    const it = test.extend("thePullRequest", () =>
      Effect.runSync(
        openPullRequestOf("/work", () =>
          Effect.succeed({
            status: 0,
            stdout:
              '{"baseRefName":"main","mergeStateStatus":"BEHIND","number":3,"url":"https://example.com/3"}',
          }),
        ),
      ));

    it("returns the parsed pull request", ({ thePullRequest }) => {
      expect(thePullRequest).toStrictEqual({
        baseRefName: "main",
        mergeStateStatus: "BEHIND",
        number: 3,
        url: "https://example.com/3",
      });
    });
  });

  describe("a gh pr view that fails", () => {
    const it = test.extend("thePullRequestWhenGhFails", () =>
      Effect.runSync(
        openPullRequestOf("/work", () =>
          Effect.succeed({ status: 1, stdout: "no pull requests found" }),
        ),
      ));

    it("returns nothing", ({ thePullRequestWhenGhFails }) => {
      expect(thePullRequestWhenGhFails).toBe(undefined);
    });
  });
});
