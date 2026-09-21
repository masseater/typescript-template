import { ROLE } from "@repo/config/identity";
import { ToastProvider } from "@repo/ui";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { overwriteGetLocale, type Locale } from "#paraglide/runtime.js";
import { MemberRail } from "./member-rail.tsx";
import { MemberTabs } from "./member-tabs.tsx";
import { MemberTopBar } from "./member-top-bar.tsx";

import type { SessionView } from "@repo/auth-ui";

const member = {
  email: "member@example.com",
  id: "member-1",
  name: "会員",
  permission: null,
  role: ROLE.member,
  twoFactorEnabled: false,
} as const satisfies SessionView["user"];

const destinations = [
  { label: "ホーム", path: "/home" },
  { label: "プロフィール", path: "/users/member-1" },
  { label: "探す", path: "/upgrade" },
  { label: "掲示板", path: "/board" },
  { label: "メッセージ", path: "/messages" },
  { label: "通知", path: "/notifications" },
] as const;

function markup(locale: Locale, view: "header" | "rail" | "tabs"): string {
  overwriteGetLocale(() => locale);
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/home" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/board" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/messages" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/notifications" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/search" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/settings" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/support" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/upgrade" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/users/$id" }),
  ]);
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: [view === "header" ? "/users/member-1" : "/home"],
    }),
    routeTree,
  });
  const child =
    view === "rail"
      ? createElement(MemberRail, { memberBoard: true, user: member })
      : view === "tabs"
        ? createElement(MemberTabs, { memberBoard: true, profileId: member.id })
        : createElement(MemberTopBar, { user: member });
  return renderToStaticMarkup(
    createElement(RouterContextProvider, {
      children: view === "tabs" ? child : createElement(ToastProvider, null, child),
      router,
    }),
  );
}

describe("member navigation", () => {
  const it = test
    .extend("theRail", () => markup("ja", "rail"))
    .extend("theTabs", () => markup("ja", "tabs"))
    .extend("thePhoneHeader", () => markup("ja", "header"))
    .extend("theEnglishRail", () => markup("en", "rail"));

  it("lists the primary destinations in the rail", ({ theRail }) => {
    expect.hasAssertions();
    for (const destination of destinations) {
      expect(theRail).toContain(`>${destination.label}<`);
      expect(theRail).toContain(`href="${destination.path}"`);
    }
  });

  it("names the phone destinations without putting their labels in one row", ({ theTabs }) => {
    expect.hasAssertions();
    for (const destination of destinations) {
      expect(theTabs).toContain(`aria-label="${destination.label}"`);
      expect(theTabs).not.toContain(`>${destination.label}<`);
    }
  });

  it("shows the product name and the current section on a phone", ({ thePhoneHeader }) => {
    expect.hasAssertions();
    expect(thePhoneHeader).toContain("ユーザーアプリ");
    expect(thePhoneHeader).toContain("プロフィール");
  });

  it("reads rail labels from the English catalog", ({ theEnglishRail }) => {
    expect.hasAssertions();
    try {
      expect(theEnglishRail).toContain(">Home<");
      expect(theEnglishRail).toContain(">Profile<");
      expect(theEnglishRail).toContain(">Board<");
      expect(theEnglishRail).toContain('href="/users/member-1"');
    } finally {
      overwriteGetLocale(() => "ja");
    }
  });
});
