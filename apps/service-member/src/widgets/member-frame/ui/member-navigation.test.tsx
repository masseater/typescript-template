import { RegistryProvider } from "@effect/atom-react";
import { ROLE } from "@repo/config/identity";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { overwriteGetLocale, type Locale } from "#paraglide/runtime.js";
import { MemberFrame } from "./member-frame.tsx";

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

async function markup(locale: Locale, path: string): Promise<string> {
  overwriteGetLocale(() => locale);
  const rootRoute = createRootRoute({
    component: () =>
      createElement(
        RegistryProvider,
        null,
        createElement(MemberFrame, {
          children: createElement("p", null, "本文"),
          memberBoard: true,
          navBadges: { notifications: 0 },
          user: member,
        }),
      ),
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree: rootRoute.addChildren([
      createRoute({
        component: () => createElement("span"),
        getParentRoute: () => rootRoute,
        path: "/",
      }),
      createRoute({
        component: () => createElement("span"),
        getParentRoute: () => rootRoute,
        path: "/home",
      }),
      createRoute({
        component: () => createElement("span"),
        getParentRoute: () => rootRoute,
        path: "/board",
      }),
      createRoute({
        component: () => createElement("span"),
        getParentRoute: () => rootRoute,
        path: "/messages",
      }),
      createRoute({
        component: () => createElement("span"),
        getParentRoute: () => rootRoute,
        path: "/notifications",
      }),
      createRoute({
        component: () => createElement("span"),
        getParentRoute: () => rootRoute,
        path: "/settings",
      }),
      createRoute({
        component: () => createElement("span"),
        getParentRoute: () => rootRoute,
        path: "/support",
      }),
      createRoute({
        component: () => createElement("span"),
        getParentRoute: () => rootRoute,
        path: "/upgrade",
      }),
      createRoute({
        component: () => createElement("span"),
        getParentRoute: () => rootRoute,
        path: "/users/$id",
      }),
    ]),
  });
  await router.load();
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

describe("member navigation", () => {
  const it = test
    .extend("theFrame", async () => markup("ja", "/home"))
    .extend("theProfileFrame", async () => markup("ja", "/users/member-1"))
    .extend("theEnglishFrame", async () => markup("en", "/home"));

  it("lists the primary destinations on the compact rail", ({ theFrame }) => {
    expect.hasAssertions();
    expect(theFrame).toContain("md:w-32");
    expect(theFrame).toContain("min-h-dvh bg-muted");
    expect(theFrame).not.toContain("<input");
    expect(theFrame).not.toContain(">ユ<");
    for (const destination of destinations) {
      expect(theFrame).toContain(`>${destination.label}<`);
      expect(theFrame).toContain(`href="${destination.path}"`);
    }
  });

  it("names the phone destinations without putting their labels in one row", ({ theFrame }) => {
    expect.hasAssertions();
    const tabs = theFrame.slice(theFrame.indexOf("fixed inset-x-0 bottom-0"));
    for (const destination of destinations) {
      expect(tabs).toContain(`aria-label="${destination.label}"`);
      expect(tabs).not.toContain(`>${destination.label}<`);
    }
  });

  it("shows the product name and the current section on a phone", ({ theProfileFrame }) => {
    expect.hasAssertions();
    expect(theProfileFrame).toContain("ユーザーアプリ");
    expect(theProfileFrame).toContain("プロフィール");
  });

  it("reads rail labels from the English catalog", ({ theEnglishFrame }) => {
    expect.hasAssertions();
    try {
      expect(theEnglishFrame).toContain(">Home<");
      expect(theEnglishFrame).toContain(">Profile<");
      expect(theEnglishFrame).toContain(">Board<");
      expect(theEnglishFrame).toContain('href="/users/member-1"');
    } finally {
      overwriteGetLocale(() => "ja");
    }
  });
});
