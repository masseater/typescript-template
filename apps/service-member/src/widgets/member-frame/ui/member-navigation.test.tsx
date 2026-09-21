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

import { MemberRail } from "./member-rail.tsx";
import { MemberTabs } from "./member-tabs.tsx";
import { MemberTopBar } from "./member-top-bar.tsx";

import type { Session } from "#entities/session/model/session.ts";

const member = {
  email: "member@example.com",
  id: "member-1",
  name: "会員",
  role: "member",
  twoFactorEnabled: false,
} as const satisfies Session["user"];

describe("member navigation", () => {
  const it = test
    .extend("theRail", () => {
      const rootRoute = createRootRoute();
      const routeTree = rootRoute.addChildren([
        createRoute({ getParentRoute: () => rootRoute, path: "/" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/home" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/search" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/upgrade" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/board" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/messages" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/notifications" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/settings" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/support" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/users/$id" }),
      ]);
      const router = createRouter({
        history: createMemoryHistory({ initialEntries: ["/home"] }),
        routeTree,
      });
      return renderToStaticMarkup(
        createElement(
          RouterContextProvider,
          { router },
          createElement(
            ToastProvider,
            null,
            createElement(MemberRail, { memberBoard: true, user: member }),
          ),
        ),
      );
    })
    .extend("theTabs", () => {
      const rootRoute = createRootRoute();
      const routeTree = rootRoute.addChildren([
        createRoute({ getParentRoute: () => rootRoute, path: "/home" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/search" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/upgrade" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/board" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/messages" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/notifications" }),
      ]);
      const router = createRouter({
        history: createMemoryHistory({ initialEntries: ["/home"] }),
        routeTree,
      });
      return renderToStaticMarkup(
        createElement(
          RouterContextProvider,
          { router },
          createElement(MemberTabs, { memberBoard: true }),
        ),
      );
    })
    .extend("thePhoneHeader", () => {
      const rootRoute = createRootRoute();
      const routeTree = rootRoute.addChildren([
        createRoute({ getParentRoute: () => rootRoute, path: "/messages" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/settings" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/support" }),
        createRoute({ getParentRoute: () => rootRoute, path: "/users/$id" }),
      ]);
      const router = createRouter({
        history: createMemoryHistory({ initialEntries: ["/messages"] }),
        routeTree,
      });
      return renderToStaticMarkup(
        createElement(
          RouterContextProvider,
          { router },
          createElement(ToastProvider, null, createElement(MemberTopBar, { user: member })),
        ),
      );
    });

  it("fits a short label in the rail and keeps the brand at the caller size", ({ theRail }) => {
    expect.hasAssertions();
    expect(theRail).toMatchInlineSnapshot(
      `"<aside class="hidden w-32 shrink-0 flex-col border-r border-border bg-card md:flex"><div class="border-b border-border px-2 py-3 text-center"><a href="/home" data-status="active" aria-current="page" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator font-bold text-sm leading-tight active">ユーザーアプリ</a></div><nav aria-label="メイン" class="flex flex-1 flex-col gap-1 p-1"><div><a title="ホーム" aria-label="ホーム" href="/home" data-status="active" aria-current="page" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-3 py-2 active"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house lucide-home shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></span><span class="flex items-center justify-center gap-1 text-sm leading-none"><span>ホーム</span></span></span></a></div><div><a title="探す（有料）" aria-label="探す（有料）" href="/upgrade" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-3 py-2"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg></span><span class="flex items-center justify-center gap-1 text-sm leading-none"><span>探す</span><span class="font-bold text-muted-foreground">有料</span></span></span></a></div><div><a title="掲示板" aria-label="掲示板" href="/board" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-3 py-2"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-stack shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M4 10c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"></path><path d="M10 16c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"></path><rect width="8" height="8" x="14" y="14" rx="2"></rect></svg></span><span class="flex items-center justify-center gap-1 text-sm leading-none"><span>掲示板</span></span></span></a></div><div><a title="メッセージ" aria-label="メッセージ" href="/messages" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-3 py-2"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path></svg></span><span class="flex items-center justify-center gap-1 text-sm leading-none"><span>メッセージ</span></span></span></a></div><div><a title="通知" aria-label="通知" href="/notifications" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-3 py-2"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg></span><span class="flex items-center justify-center gap-1 text-sm leading-none"><span>通知</span></span></span></a></div></nav><div class="mt-auto border-t border-border p-2"><button type="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" id="base-ui-_R_1nm_" data-slot="dropdown-menu-trigger" aria-label="会員 のアカウントメニュー" class="box-border inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent p-1 text-base leading-none text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator disabled:cursor-not-allowed disabled:text-disabled-foreground data-popup-open:bg-card-hover"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-round lucide-user-2 shrink-0 size-5" data-slot="icon" aria-hidden="true"><circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path></svg></button></div></aside>"`,
    );
  });

  it("names five phone destinations without putting their labels in one row", ({ theTabs }) => {
    expect.hasAssertions();
    expect(theTabs).toMatchInlineSnapshot(
      `"<nav aria-label="メイン" class="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card md:hidden"><div class="flex-1"><a title="ホーム" aria-label="ホーム" href="/home" data-status="active" aria-current="page" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-1 py-2 text-center active"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house lucide-home shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></span></span></a></div><div class="flex-1"><a title="探す（有料）" aria-label="探す（有料）" href="/upgrade" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-1 py-2 text-center"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle></svg></span><span class="text-sm leading-none font-bold text-muted-foreground">有料</span></span></a></div><div class="flex-1"><a title="掲示板" aria-label="掲示板" href="/board" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-1 py-2 text-center"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-stack shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M4 10c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"></path><path d="M10 16c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"></path><rect width="8" height="8" x="14" y="14" rx="2"></rect></svg></span></span></a></div><div class="flex-1"><a title="メッセージ" aria-label="メッセージ" href="/messages" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-1 py-2 text-center"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path></svg></span></span></a></div><div class="flex-1"><a title="通知" aria-label="通知" href="/notifications" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-1 py-2 text-center"><span class="flex flex-col items-center gap-1"><span class="relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg></span></span></a></div></nav>"`,
    );
  });

  it("shows the product name and the current section on a phone", ({ thePhoneHeader }) => {
    expect.hasAssertions();
    expect(thePhoneHeader).toMatchInlineSnapshot(
      `"<header class="flex items-center gap-3 border-b border-border bg-card px-3 py-2 md:hidden"><button type="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" id="base-ui-_R_1mm_" data-slot="dropdown-menu-trigger" aria-label="会員 のアカウントメニュー" class="box-border inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent p-1 text-base leading-none text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator disabled:cursor-not-allowed disabled:text-disabled-foreground data-popup-open:bg-card-hover"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-round lucide-user-2 shrink-0 size-5" data-slot="icon" aria-hidden="true"><circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path></svg></button><div class="min-w-0 flex-1 text-center"><p class="truncate text-sm leading-tight font-bold">ユーザーアプリ</p><p class="truncate text-base leading-tight font-bold">メッセージ</p></div><span class="w-9" aria-hidden="true"></span></header>"`,
    );
  });
});
