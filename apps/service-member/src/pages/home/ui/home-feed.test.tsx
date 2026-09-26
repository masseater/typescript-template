import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { overwriteGetLocale } from "#paraglide/runtime.js";
import { HomeFeed } from "./home-feed.tsx";

import type { HomeEntry } from "#pages/home/model/home-feed-state.ts";

const first = {
  actorId: "hana",
  actorName: "山田 花子",
  change: "週末は本屋めぐり。",
  key: "hana-1",
  updatedAtLabel: "2026年4月2日 9:00",
} as const satisfies HomeEntry;

const second = {
  actorId: "taro",
  actorName: "佐藤 太郎",
  change: "近況を短く書きました。",
  key: "taro-1",
  updatedAtLabel: "2026年4月1日 9:00",
} as const satisfies HomeEntry;

function rendered(state: Parameters<typeof HomeFeed>[0]["state"]): string {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/users" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/users/$id" }),
  ]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/home"] }),
    routeTree,
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <HomeFeed state={state} />
    </RouterContextProvider>,
  );
}

describe("home feed", () => {
  it("puts the latest person first and shows the change without opening a profile", () => {
    expect.hasAssertions();
    const html = rendered({ entries: [first, second], status: "ready" });
    const leadAt = html.indexOf('data-slot="home-lead"');
    const lead = html.slice(leadAt, html.indexOf("</article>", leadAt));
    expect(lead).toContain(first.actorName);
    expect(lead).toContain(first.change);
    expect(lead).toContain('href="/users/hana"');
    expect(lead).not.toContain(second.actorName);
    expect(html.indexOf(second.actorName)).toBeGreaterThan(leadAt);
    expect(html).toContain(second.change);
    expect(html).toContain("max-w-page");
  });

  it("offers one next action when idle and does not spin", () => {
    expect.hasAssertions();
    overwriteGetLocale(() => "ja");
    const html = rendered({ status: "empty" });
    expect(html).toContain("フォローしている利用者の動きはまだありません。");
    expect(html).toContain('href="/users"');
    expect(html.match(/href="\/users"/gu)).toHaveLength(1);
    expect(html).not.toContain('data-slot="spinner"');
  });

  it("shows a spinner only while the feed is loading", () => {
    expect.hasAssertions();
    expect(rendered({ status: "pending" })).toContain('data-slot="spinner"');
  });
});
