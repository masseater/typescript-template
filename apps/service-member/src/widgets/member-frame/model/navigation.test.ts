import { describe, expect, it } from "vite-plus/test";

import { overwriteGetLocale } from "#paraglide/runtime.js";
import { memberNavItems, titleForPath } from "./navigation.ts";

describe("memberNavItems", () => {
  it("sends free members from 探す to upgrade", () => {
    expect.hasAssertions();
    const search = memberNavItems(false, "member-1").find((item) => item.id === "search");
    expect(search?.to).toBe("/upgrade");
    expect(search?.paid).toBe(true);
  });

  it("keeps paid members on 探す", () => {
    expect.hasAssertions();
    const search = memberNavItems(true, "member-1").find((item) => item.id === "search");
    expect(search?.to).toBe("/search");
  });

  it("lists the primary destinations including the board", () => {
    expect.hasAssertions();
    expect(memberNavItems(false, "member-1").map((item) => item.id)).toStrictEqual([
      "home",
      "profile",
      "search",
      "board",
      "messages",
      "notifications",
    ]);
    expect(memberNavItems(false, "member-1").find((item) => item.id === "profile")).toMatchObject({
      params: { id: "member-1" },
      to: "/users/$id",
    });
  });
});

describe("titleForPath", () => {
  it("names known shells and nested pages from the catalog", () => {
    expect.hasAssertions();
    try {
      overwriteGetLocale(() => "ja");
      expect(titleForPath("/home")).toBe("ホーム");
      expect(titleForPath("/users/abc")).toBe("プロフィール");
      expect(titleForPath("/settings/plan")).toBe("設定");
      overwriteGetLocale(() => "en");
      expect(titleForPath("/home")).toBe("Home");
      expect(titleForPath("/messages")).toBe("Messages");
      expect(titleForPath("/board/thread-1")).toBe("Thread");
    } finally {
      overwriteGetLocale(() => "ja");
    }
  });
});
