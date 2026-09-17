import { describe, expect, it } from "vite-plus/test";
import { normalizeUsersSearch, userListQuery } from "#users-search.ts";

describe("users page search normalization", () => {
  it("keeps every well-formed condition", () => {
    expect.hasAssertions();
    expect(
      normalizeUsersSearch({ keyword: "alice", page: 3, role: "admin", verified: false }),
    ).toStrictEqual({ keyword: "alice", page: 3, role: "admin", verified: false });
  });

  it("reads the verification flag a hand-written URL decodes to", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ verified: "true" })).toStrictEqual({ verified: true });
    expect(normalizeUsersSearch({ verified: "false" })).toStrictEqual({ verified: false });
  });

  it("drops a role and a verification flag the API does not accept", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ keyword: "bob", role: "owner", verified: "yes" })).toStrictEqual({
      keyword: "bob",
    });
    expect(normalizeUsersSearch({ verified: 1 })).toStrictEqual({});
  });
});

describe("user list request query", () => {
  it("turns the page number into an offset and forwards the filters", () => {
    expect.hasAssertions();
    expect(userListQuery({ keyword: "花子", page: 3, role: "user", verified: true })).toStrictEqual(
      {
        emailVerified: "true",
        keyword: "花子",
        limit: "50",
        offset: "100",
        role: "user",
      },
    );
    expect(userListQuery({ verified: false })).toStrictEqual({
      emailVerified: "false",
      limit: "50",
      offset: "0",
    });
    expect(userListQuery({})).toStrictEqual({ limit: "50", offset: "0" });
  });
});
