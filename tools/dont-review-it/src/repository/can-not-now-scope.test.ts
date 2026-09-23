import { describe, expect, it } from "vite-plus/test";

import { pendingIssues, trustedComments, type IssueRecord } from "./can-not-now-scope.ts";

const repository = "owner/name";

const issue = (number: number, author_association: string): IssueRecord => ({
  author_association,
  body: `body ${number}`,
  number,
  title: `title ${number}`,
});

describe("issues handed to the can-not-now run", () => {
  it("keeps only issues written by people with write access to the repository", () => {
    expect.hasAssertions();
    expect(
      pendingIssues({
        issues: [
          issue(1, "OWNER"),
          issue(2, "MEMBER"),
          issue(3, "COLLABORATOR"),
          issue(4, "CONTRIBUTOR"),
          issue(5, "NONE"),
        ],
        openPulls: [],
        repository,
      }).map((kept) => kept.number),
    ).toStrictEqual([1, 2, 3]);
  });

  it("drops pull requests that the issues endpoint lists beside issues", () => {
    expect.hasAssertions();
    expect(
      pendingIssues({
        issues: [{ ...issue(1, "OWNER"), pull_request: {} }, issue(2, "OWNER")],
        openPulls: [],
        repository,
      }).map((kept) => kept.number),
    ).toStrictEqual([2]);
  });

  it("drops issues whose branch in this repository already has an open pull request", () => {
    expect.hasAssertions();
    expect(
      pendingIssues({
        issues: [issue(1, "OWNER"), issue(2, "OWNER")],
        openPulls: [
          { head: { ref: "can-not-now/issue-1", repo: { full_name: repository } } },
          { head: { ref: "can-not-now/issue-2", repo: { full_name: "fork/name" } } },
        ],
        repository,
      }).map((kept) => kept.number),
    ).toStrictEqual([2]);
  });

  it("takes the three oldest issues", () => {
    expect.hasAssertions();
    expect(
      pendingIssues({
        issues: [issue(9, "OWNER"), issue(4, "OWNER"), issue(7, "OWNER"), issue(2, "OWNER")],
        openPulls: [],
        repository,
      }).map((kept) => kept.number),
    ).toStrictEqual([2, 4, 7]);
  });

  it("keeps only comments written by people with write access to the repository", () => {
    expect.hasAssertions();
    expect(
      trustedComments([
        { author_association: "OWNER", body: "kept", user: { login: "owner" } },
        { author_association: "NONE", body: "dropped", user: { login: "stranger" } },
        { author_association: "MEMBER", body: null, user: { login: "member" } },
        { author_association: "OWNER", body: "ghost", user: null },
      ]),
    ).toStrictEqual([
      { author: "owner", body: "kept" },
      { author: "member", body: "" },
    ]);
  });
});
