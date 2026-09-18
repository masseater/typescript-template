import { describe, expect, it } from "vite-plus/test";
import { maximumKeywordLength, maximumMemberPage } from "@repo/runtime/contracts";
import { normalizeUsersSearch } from "./users-search.ts";

describe("member list search in the URL", () => {
  it("keeps a trimmed keyword and a later page", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ keyword: " 花子 ", page: 3 })).toStrictEqual({
      keyword: "花子",
      page: 3,
    });
  });

  it("stops at the last page the member API accepts", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ page: maximumMemberPage })).toStrictEqual({
      page: maximumMemberPage,
    });
    expect(normalizeUsersSearch({ page: maximumMemberPage + 1 })).toStrictEqual({});
  });

  it("drops a keyword longer than the member API accepts", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ keyword: "あ".repeat(maximumKeywordLength + 1) })).toStrictEqual(
      {},
    );
  });

  it("drops the conditions this page does not have", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ role: "admin", verified: true })).toStrictEqual({});
  });
});
