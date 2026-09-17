import { describe, expect, it } from "vite-plus/test";
import { maximumKeywordLength } from "@template/runtime/contracts";
import { normalizeUsersSearch } from "./users-search.ts";

describe("member list search in the URL", () => {
  it("keeps a trimmed keyword and a later page", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ keyword: " 花子 ", page: 3 })).toStrictEqual({
      keyword: "花子",
      page: 3,
    });
  });

  it("reads a keyword the URL parser turned into a number", () => {
    expect.hasAssertions();
    expect(normalizeUsersSearch({ keyword: 2026 })).toStrictEqual({ keyword: "2026" });
  });

  it.for([
    { page: 1 },
    { page: 0 },
    { page: 1.5 },
    { page: "abc" },
    { keyword: "" },
    { keyword: "   " },
    { keyword: "あ".repeat(maximumKeywordLength + 1) },
    { keyword: ["a"] },
    { role: "admin" },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ])("drops %o so the first unfiltered page is shown", (raw) => {
    expect.hasAssertions();
    expect(normalizeUsersSearch(raw)).toStrictEqual({});
  });
});
