import { describe, expect, it } from "vite-plus/test";

import { overwriteGetLocale } from "#paraglide/runtime.js";
import { memberNavItems, titleForPath } from "./navigation.ts";

describe("memberNavItems", () => {
  it("lists home, profile, and the board when the board flag is on", () => {
    expect.hasAssertions();
    expect(memberNavItems(true, "member-1").map((item) => item.id)).toStrictEqual([
      "home",
      "profile",
      "board",
    ]);
    expect(memberNavItems(true, "member-1").find((item) => item.id === "profile")).toMatchObject({
      params: { id: "member-1" },
      to: "/users/$id",
    });
  });

  it("hides the board tab when the board flag is off", () => {
    expect.hasAssertions();
    expect(memberNavItems(false, "member-1").map((item) => item.id)).toStrictEqual([
      "home",
      "profile",
    ]);
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
