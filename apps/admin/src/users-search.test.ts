import { describe, expect, it } from "vite-plus/test";
import { normalizeUsersSearch, userListRequestPath } from "#users-search.ts";

const KEYWORD_LIMIT = 100;

describe("users page search normalization", () => {
  it("keeps every well-formed condition", () => {
    expect.hasAssertions();
    expect(
      normalizeUsersSearch({ keyword: "alice", page: 3, role: "admin", verified: "false" }),
    ).toStrictEqual({ keyword: "alice", page: 3, role: "admin", verified: "false" });
  });

  it("drops malformed conditions and keeps the rest", () => {
    expect.hasAssertions();
    expect(
      normalizeUsersSearch({
        extra: "x",
        keyword: "  bob  ",
        page: 0,
        role: "owner",
        verified: "yes",
      }),
    ).toStrictEqual({ keyword: "bob" });
    expect(normalizeUsersSearch({ keyword: "   ", page: 1.5 })).toStrictEqual({});
    expect(
      normalizeUsersSearch({ keyword: "a".repeat(KEYWORD_LIMIT + 1), page: "2" }),
    ).toStrictEqual({
      page: 2,
    });
    expect(normalizeUsersSearch("not a record")).toStrictEqual({});
  });

  it("treats the first page as the absence of a page", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ page: 1 })).toStrictEqual({});
  });
});

describe("user list request path", () => {
  it("turns the page number into an offset and forwards the filters", () => {
    expect.hasAssertions();
    expect(userListRequestPath({ keyword: "花子", page: 3, role: "user", verified: "true" })).toBe(
      "/api/users?limit=50&offset=100&keyword=%E8%8A%B1%E5%AD%90&role=user&verified=true",
    );
    expect(userListRequestPath({})).toBe("/api/users?limit=50&offset=0");
  });
});
