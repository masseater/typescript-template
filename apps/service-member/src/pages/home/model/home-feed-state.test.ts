import { describe, expect, it } from "vite-plus/test";

import { overwriteGetLocale } from "#paraglide/runtime.js";
import { homeState, presentFeed } from "./home-feed-state.ts";

import type { HomeEntry } from "./home-feed-state.ts";

const first = {
  actorId: "hana",
  actorName: "山田 花子",
  change: "週末は本屋めぐり。",
  key: "hana-1",
  updatedAtLabel: "2026年4月2日 9:00",
} as const satisfies HomeEntry;

describe("home feed state", () => {
  it("shows the written profile, and says when the introduction is still empty", () => {
    expect.hasAssertions();
    overwriteGetLocale(() => "ja");
    const [written, blank] = presentFeed(
      [
        { actorId: "hana", actorName: "山田 花子", profile: "週末は本屋めぐり。", updatedAt: 1 },
        { actorId: "taro", actorName: "佐藤 太郎", profile: "", updatedAt: 2 },
      ],
      () => "日付",
    );
    expect(written?.change).toBe("週末は本屋めぐり。");
    expect(blank?.change).toBe("自己紹介はまだ書かれていません。");
  });

  it("settles the feed state with a failure first, then loading, then emptiness", () => {
    expect.hasAssertions();
    expect(homeState("取得できませんでした。", [first], false)).toStrictEqual({
      message: "取得できませんでした。",
      status: "failure",
    });
    expect(homeState(undefined, [first], true)).toStrictEqual({ status: "pending" });
    expect(homeState(undefined, undefined, false)).toStrictEqual({ status: "pending" });
    expect(homeState(undefined, [], false)).toStrictEqual({ status: "empty" });
    expect(homeState(undefined, [first], false)).toStrictEqual({
      entries: [first],
      status: "ready",
    });
  });
});
