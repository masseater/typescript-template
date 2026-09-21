import { formatWarekiMonth } from "@repo/ui";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { baselineProfileLayout } from "#shared/profile-layout/default.ts";
import { ProfilePage } from "./profile-page.tsx";

import type { Member } from "#pages/profile/model/member.ts";

const member = {
  id: "member-1",
  joined: "2026-04",
  name: "山田 花子",
  photos: { company: null, face: null },
  profile: "本屋めぐりをしています。",
  profileLayout: baselineProfileLayout,
  sheet: {},
  socialLinks: [],
} as const satisfies Member;

function rendered(own: boolean): string {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/settings/profile" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/messages/new" }),
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
  it("renders the layout blocks with the biography and registration month", () => {
    expect.hasAssertions();
    const html = rendered(true);
    expect(html).toContain("<h1");
    expect(html).toContain(member.name);
    expect(html).toContain(member.profile);
    expect(html).toContain(`${formatWarekiMonth(member.joined)}に登録`);
    expect(html).toContain('href="/settings/profile"');
  });

  it("keeps edit off another member's page and offers follow actions", () => {
    expect.hasAssertions();
    const html = rendered(false);
    expect(html).not.toContain('href="/settings/profile"');
    expect(html).toContain("フォロー");
    expect(html).toContain("ブロック");
  });
});
