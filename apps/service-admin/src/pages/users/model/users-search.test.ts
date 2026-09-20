import { maximumKeywordLength } from "@repo/runtime/contracts";
import { describe, expect, it } from "vite-plus/test";

import { maximumUsersPage } from "./users-pagination.ts";
import { InvalidUsersSearch, normalizeUsersSearch, userListQuery } from "./users-search.ts";

const numericKeyword = 2026;

describe("users page search normalization", () => {
  it("keeps every well-formed condition", () => {
    expect.hasAssertions();
    expect(
      normalizeUsersSearch({ keyword: "alice", page: 3, role: "admin", verified: false }),
    ).toStrictEqual({ keyword: "alice", page: 3, role: "admin", verified: false });
  });

  it("accepts the shapes a hand-written URL decodes to", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ keyword: numericKeyword, page: "2" })).toStrictEqual({
      keyword: "2026",
      page: 2,
    });
    expect(normalizeUsersSearch({ verified: "true" })).toStrictEqual({ verified: true });
    expect(normalizeUsersSearch({ verified: "false" })).toStrictEqual({ verified: false });
    expect(normalizeUsersSearch(JSON.parse('{"keyword":null}'))).toStrictEqual({ keyword: "null" });
  });

  it("rejects a broken page or role instead of dropping them into an empty search", () => {
    expect.hasAssertions();
    expect(() =>
      normalizeUsersSearch({
        extra: "x",
        keyword: "  bob  ",
        page: 0,
        role: "owner",
        verified: "yes",
      }),
    ).toThrow(InvalidUsersSearch);
    expect(() => normalizeUsersSearch({ verified: 1 })).toThrow(InvalidUsersSearch);
    expect(() => normalizeUsersSearch({ keyword: "a".repeat(maximumKeywordLength + 1) })).toThrow(
      InvalidUsersSearch,
    );
  });
});

describe("users page paging in the URL", () => {
  it("stops at the last page the user list API can address", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ page: maximumUsersPage })).toStrictEqual({
      page: maximumUsersPage,
    });
    expect(() => normalizeUsersSearch({ page: maximumUsersPage + 1 })).toThrow(InvalidUsersSearch);
    expect(() => normalizeUsersSearch({ page: 1e20 })).toThrow(InvalidUsersSearch);
  });

  it("rejects a search that is not a record", () => {
    expect.hasAssertions();
    expect(() => normalizeUsersSearch("not a record")).toThrow(InvalidUsersSearch);
  });
});

describe("user list request query", () => {
  it("turns the page number into an offset and forwards the filters", () => {
    expect.hasAssertions();
    expect(
      userListQuery({ keyword: "花子", page: 3, role: "member", verified: true }),
    ).toStrictEqual({
      emailVerified: "true",
      keyword: "花子",
      limit: "50",
      offset: "100",
      role: "member",
    });
    expect(userListQuery({ verified: false })).toStrictEqual({
      emailVerified: "false",
      limit: "50",
      offset: "0",
    });
    expect(userListQuery({})).toStrictEqual({ limit: "50", offset: "0" });
  });
});
