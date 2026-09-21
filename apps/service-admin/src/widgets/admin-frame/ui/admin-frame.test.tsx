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

import { AdminFrame } from "./admin-frame.tsx";

describe("折りたたんだ管理画面", () => {
  const it = test.extend("collapsedAdminFrameMarkup", async () => {
    const rootRoute = createRootRoute({
      component: () =>
        createElement(
          RegistryProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(AdminFrame, {
              children: createElement("p", null, "本文"),
              defaultCollapsed: true,
              email: "ada@example.com",
              name: "Ada",
            }),
          ),
        ),
    });
    const routeTree = rootRoute.addChildren(
      ["/members", "/inquiries", "/reports", "/terms", "/admins", "/security"].map((path) =>
        createRoute({
          component: () => createElement("span"),
          getParentRoute: () => rootRoute,
          path,
        }),
      ),
    );
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/members"] }),
      routeTree,
    });
    await router.load();
    return renderToStaticMarkup(createElement(RouterProvider, { router }));
  });

  it("折りたたみ時の名前は管理画面で、検索欄はない", ({ collapsedAdminFrameMarkup }) => {
    expect(collapsedAdminFrameMarkup).toMatchInlineSnapshot(
      `"<div class="flex min-h-dvh bg-muted"><aside class="flex shrink-0 flex-col border-r border-border bg-card md:w-14 hidden md:flex"><div class="border-b border-border py-3 px-2 text-center"><p class="text-sm leading-tight font-bold text-foreground"><span class="sr-only">管理画面</span><span aria-hidden="true">管理</span></p></div><nav id="admin-navigation" aria-label="メイン" class="flex flex-1 flex-col overflow-y-auto"><div class="flex flex-1 flex-col gap-4 p-2"><div class="flex flex-col gap-1"><ul class="flex flex-col gap-1"><li><a title="利用者" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground" href="/members" data-status="active" aria-current="page" data-slot="navigation-link"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg></span></a></li><li><a title="問い合わせ" href="/inquiries" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path></svg></span></a></li><li><a title="通報" href="/reports" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flag shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"></path></svg></span></a></li></ul></div><div class="flex flex-col gap-1"><ul class="flex flex-col gap-1"><li><a title="規約" href="/terms" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg></span></a></li><li><a title="管理者" href="/admins" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground"><span class="flex items-center gap-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path></svg></span></a></li></ul></div></div></nav><div class="mt-auto border-t border-border p-2"><button type="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" id="base-ui-_R_6ur6_" data-slot="dropdown-menu-trigger" aria-label="Ada のアカウントメニュー" class="box-border inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent p-1 text-base leading-none text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator disabled:cursor-not-allowed disabled:text-disabled-foreground data-popup-open:bg-card-hover"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down shrink-0 size-4" data-slot="icon" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></button></div></aside><div class="flex min-w-0 flex-1 flex-col p-2 md:p-3"><div class="rounded-xl flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-card shadow-sm"><header class="flex items-center gap-2 border-b border-border px-4 py-2"><button type="button" aria-label="メニュー" aria-expanded="false" aria-controls="admin-navigation" class="cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:hidden"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu shrink-0 size-5" data-slot="icon" aria-hidden="true"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path></svg></button><button type="button" aria-label="サイドバーを開く" aria-pressed="true" class="hidden cursor-pointer rounded-md p-1 text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator md:inline-flex"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-left lucide-sidebar shrink-0 size-5" data-slot="icon" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path></svg></button><nav aria-label="パンくず" class="min-w-0 truncate text-base leading-tight font-bold">利用者の一覧</nav></header><div class="min-h-0 flex-1 overflow-auto"><p>本文</p></div></div></div></div>"`,
    );
  });
});
