import { formatWarekiMonth } from "@repo/ui";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ProfilePage } from "./profile-page.tsx";

import type { Member } from "#pages/profile/model/member.ts";

const member = {
  id: "member-1",
  joined: "2026-04",
  name: "山田 花子",
  profile: "本屋めぐりをしています。",
  socialLinks: [],
} as const satisfies Member;

function rendered(own: boolean): string {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/settings/profile" }),
  ]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/users/member-1"] }),
    routeTree,
  });
  return renderToStaticMarkup(
    createElement(RouterContextProvider, {
      children: createElement(ProfilePage, { member, own }),
      router,
    }),
  );
}

describe("profile page", () => {
  it("renders the member page with a cover, an overlapping portrait, and the biography", () => {
    expect.hasAssertions();
    const html = rendered(true);
    expect(html).toContain('data-slot="member-page"');
    expect(html).toContain("h-24");
    expect(html).toContain("-mt-10");
    expect(html).toContain("<h1");
    expect(html).toContain(member.name);
    expect(html).toContain(member.profile);
    expect(html).toContain(`${formatWarekiMonth(member.joined)}に登録`);
    expect(html).toContain('href="/settings/profile"');
    const pageAt = html.indexOf('data-slot="member-page"');
    expect(html.indexOf(member.name)).toBeGreaterThan(pageAt);
    expect(html.indexOf("-mt-10")).toBeGreaterThan(html.indexOf("h-24"));
  });

  it("keeps edit off another member's page", () => {
    expect.hasAssertions();
    expect(rendered(false)).not.toContain('href="/settings/profile"');
  });
});
