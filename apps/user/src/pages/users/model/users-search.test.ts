import { describe, expect, it } from "vite-plus/test";
import { maximumKeywordLength } from "@template/runtime/contracts";
import { normalizeUsersSearch } from "./users-search.ts";

describe("member list search in the URL", () => {
  it("keeps a trimmed keyword", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ keyword: " 花子 " })).toStrictEqual({ keyword: "花子" });
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
