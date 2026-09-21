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

import { DashboardHeader } from "./dashboard-header.tsx";

describe("社内ダッシュボードのヘッダー", () => {
  const it = test.extend("dashboardHeaderMarkup", async () => {
    const rootRoute = createRootRoute({
      component: () =>
        createElement(DashboardHeader, {
          collapsed: false,
          navigationOpen: false,
          onToggleCollapsed: () => undefined,
          onToggleNavigation: () => undefined,
        }),
    });
    const inquiriesRoute = createRoute({
      component: () => createElement("span"),
      getParentRoute: () => rootRoute,
      path: "/inquiries",
    });
    const wikiRoute = createRoute({
      component: () => createElement("span"),
      getParentRoute: () => rootRoute,
      path: "/wiki",
    });
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/inquiries"] }),
      routeTree: rootRoute.addChildren([inquiriesRoute, wikiRoute]),
    });
    await router.load();
    return renderToStaticMarkup(createElement(RouterProvider, { router }));
  });

  it("画面名を示し、検索欄を出さない", ({ dashboardHeaderMarkup }) => {
    expect(dashboardHeaderMarkup).toMatchInlineSnapshot(
      `"<header class="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2"><button type="button" aria-label="メニュー" aria-expanded="false" aria-controls="dashboard-navigation" class="cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:hidden"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path></svg></button><button type="button" aria-label="サイドバーを畳む" aria-pressed="false" class="hidden cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:inline-flex"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-left lucide-sidebar shrink-0 size-5" data-slot="icon" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path></svg></button><nav aria-label="パンくず" class="min-w-0 truncate text-base leading-tight font-bold">問い合わせ</nav><a href="https://analytics.google.com/" target="_blank" rel="noreferrer" class="ml-auto rounded-sm text-link underline outline-none hover:text-link-hover focus-visible:focus-indicator-outer">Google Analytics</a><a href="/wiki" data-slot="button-link" class="box-border inline-flex w-fit shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border text-center font-bold whitespace-nowrap no-underline transition-colors outline-none select-none focus-visible:focus-indicator disabled:cursor-not-allowed px-2 py-1.5 text-base leading-none border-border bg-card text-foreground hover:bg-card-hover hover:text-foreground disabled:border-border/50 disabled:bg-card-hover disabled:text-disabled-foreground">Wiki</a></header>"`,
    );
  });
});
