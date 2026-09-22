import { describe, expect, test } from "vite-plus/test";

import { openPullRequestOf } from "./read-open-pr.ts";

describe("openPullRequestOf", () => {
  describe("a successful gh pr view of an open pull request", () => {
    const it = test
      .extend("theLaunchGhReceived", () => {
        let launch:
          | {
              readonly cwd: string;
              readonly executable: string;
              readonly handed: readonly string[];
            }
          | undefined;
        const pullRequest = openPullRequestOf("/work", (received) => {
          launch = received;
          return {
            status: 0,
            stdout:
              '{"baseRefName":"main","mergeStateStatus":"BEHIND","number":3,"url":"https://example.com/3"}',
          };
        });
        return { launch, pullRequest };
      })
      .extend("theLaunch", ({ theLaunchGhReceived }) => theLaunchGhReceived.launch)
      .extend("thePullRequest", ({ theLaunchGhReceived }) => theLaunchGhReceived.pullRequest);

    it("asks gh for the fields the instruction needs", ({ theLaunch }) => {
      expect(theLaunch).toStrictEqual({
        cwd: "/work",
        executable: "gh",
        handed: ["pr", "view", "--json", "number,url,baseRefName,mergeStateStatus"],
      });
    });

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
      openPullRequestOf("/work", () => ({ status: 1, stdout: "no pull requests found" })),
    );

    it("returns nothing", ({ thePullRequestWhenGhFails }) => {
      expect(thePullRequestWhenGhFails).toBe(undefined);
    });
  });
});
