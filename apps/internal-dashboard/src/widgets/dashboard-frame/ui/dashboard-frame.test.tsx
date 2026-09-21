import { RegistryProvider } from "@effect/atom-react";
import { ToastProvider } from "@repo/ui";
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

import { DashboardFrame } from "./dashboard-frame.tsx";

describe("折りたたんだ社内ダッシュボード", () => {
  const it = test.extend("collapsedDashboardFrameMarkup", async () => {
    const rootRoute = createRootRoute({
      component: () =>
        createElement(
          RegistryProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(DashboardFrame, {
              children: createElement("p", null, "本文"),
              defaultCollapsed: true,
              email: "ada@example.com",
              name: "Ada",
            }),
          ),
        ),
    });
    const routeTree = rootRoute.addChildren(
      ["/", "/inquiries", "/audit", "/flags", "/staff", "/security", "/wiki"].map((path) =>
        createRoute({
          component: () => createElement("span"),
          getParentRoute: () => rootRoute,
          path,
        }),
      ),
    );
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/inquiries"] }),
      routeTree,
    });
    await router.load();
    return renderToStaticMarkup(createElement(RouterProvider, { router }));
  });

  it("折りたたみ時の名前は社内ダッシュボードで、検索欄はない", ({
    collapsedDashboardFrameMarkup,
  }) => {
    expect(collapsedDashboardFrameMarkup).toMatchInlineSnapshot(
      `"<div class="flex min-h-dvh bg-muted"><aside class="flex shrink-0 flex-col border-r border-border bg-card md:w-14 hidden md:flex"><div class="border-b border-border py-3 px-2 text-center"><p class="text-sm leading-tight font-bold text-foreground"><span class="sr-only">社内ダッシュボード</span><span aria-hidden="true">社内</span></p></div><nav id="dashboard-navigation" aria-label="メイン" class="flex flex-1 flex-col overflow-y-auto"><div class="flex flex-1 flex-col gap-4 p-2"><div class="flex flex-col gap-1"><ul class="flex flex-col gap-1"><li><a title="概要" href="/" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-dashboard shrink-0 size-5" data-slot="icon" aria-hidden="true"><rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect></svg></span></a></li><li><a title="問い合わせ" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground" href="/inquiries" data-status="active" aria-current="page" data-slot="navigation-link"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path></svg></span></a></li><li><a title="監査ログ" href="/audit" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scroll-text shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M15 12h-5"></path><path d="M15 8h-5"></path><path d="M19 17V5a2 2 0 0 0-2-2H4"></path><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"></path></svg></span></a></li></ul></div><div class="flex flex-col gap-1"><ul class="flex flex-col gap-1"><li><a title="機能フラグ" href="/flags" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flag shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"></path></svg></span></a></li><li><a title="メンバー" href="/staff" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg></span></a></li></ul></div></div></nav><div class="mt-auto border-t border-border p-2"><button type="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" id="base-ui-_R_6ur6_" data-slot="dropdown-menu-trigger" aria-label="Ada のアカウントメニュー" class="box-border inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent p-1 text-base leading-none text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator disabled:cursor-not-allowed disabled:text-disabled-foreground data-popup-open:bg-card-hover"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down shrink-0 size-4" data-slot="icon" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></button></div></aside><div class="flex min-w-0 flex-1 flex-col p-2 md:p-3"><div class="rounded-xl flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-card shadow-sm"><header class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2"><button type="button" aria-label="メニュー" aria-expanded="false" aria-controls="dashboard-navigation" class="cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:hidden"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path></svg></button><button type="button" aria-label="サイドバーを開く" aria-pressed="true" class="hidden cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:inline-flex"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-left lucide-sidebar shrink-0 size-5" data-slot="icon" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path></svg></button><nav aria-label="パンくず" class="min-w-0 truncate text-base leading-tight font-bold">問い合わせ</nav><a href="https://analytics.google.com/" target="_blank" rel="noreferrer" class="ml-auto rounded-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer">Google Analytics</a><a href="/wiki" data-slot="button-link" class="box-border inline-flex w-fit shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border text-center font-bold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:focus-indicator disabled:cursor-not-allowed px-2 py-1.5 text-base leading-none border-border bg-card text-foreground hover:bg-card-hover hover:text-foreground disabled:border-border/50 disabled:bg-card-hover disabled:text-disabled-foreground">Wiki</a></header><div class="min-h-0 flex-1 overflow-auto"><p>本文</p></div></div></div></div>"`,
    );
  });
});
