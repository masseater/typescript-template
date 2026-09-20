import { describe, expect, it } from "vite-plus/test";

import { memberHasPaidPlan, memberNavItems, titleForPath } from "./navigation.ts";

describe("memberNavItems", () => {
  it("sends free members from 探す to upgrade", () => {
    expect.hasAssertions();
    expect(memberHasPaidPlan).toBe(false);
    const search = memberNavItems(false).find((item) => item.id === "search");
    expect(search?.to).toBe("/upgrade");
    expect(search?.paid).toBe(true);
  });

  it("keeps paid members on 探す", () => {
    expect.hasAssertions();
    const search = memberNavItems(true).find((item) => item.id === "search");
    expect(search?.to).toBe("/search");
  });

  it("lists the five primary destinations", () => {
    expect.hasAssertions();
    expect(memberNavItems(false).map((item) => item.id)).toStrictEqual([
      "home",
      "search",
      "board",
      "messages",
      "notifications",
    ]);
  });
});

describe("titleForPath", () => {
  it("names known shells and nested pages", () => {
    expect.hasAssertions();
    expect(titleForPath("/home")).toBe("ホーム");
    expect(titleForPath("/users/abc")).toBe("プロフィール");
    expect(titleForPath("/settings/plan")).toBe("設定");
  });
});
