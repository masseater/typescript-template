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

import { AdminHeader } from "./admin-header.tsx";

describe("管理画面のヘッダー", () => {
  const it = test.extend("adminHeaderMarkup", async () => {
    const rootRoute = createRootRoute({
      component: () =>
        createElement(AdminHeader, {
          collapsed: false,
          navigationOpen: false,
          onToggleCollapsed: () => undefined,
          onToggleNavigation: () => undefined,
        }),
    });
    const membersRoute = createRoute({
      component: () => createElement("span"),
      getParentRoute: () => rootRoute,
      path: "/members",
    });
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/members"] }),
      routeTree: rootRoute.addChildren([membersRoute]),
    });
    await router.load();
    return renderToStaticMarkup(createElement(RouterProvider, { router }));
  });

  it("画面名を示し、検索欄を出さない", ({ adminHeaderMarkup }) => {
    expect(adminHeaderMarkup).toMatchInlineSnapshot(
      `"<header class="flex items-center gap-2 border-b border-border px-4 py-2"><button type="button" aria-label="メニュー" aria-expanded="false" aria-controls="admin-navigation" class="cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:hidden"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path></svg></button><button type="button" aria-label="サイドバーを畳む" aria-pressed="false" class="hidden cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:inline-flex"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-left lucide-sidebar shrink-0 size-5" data-slot="icon" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path></svg></button><nav aria-label="パンくず" class="min-w-0 truncate text-base leading-tight font-bold">利用者の一覧</nav></header>"`,
    );
  });
});
