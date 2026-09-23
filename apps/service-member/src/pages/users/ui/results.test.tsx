import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { Results } from "./results.tsx";

import type { UsersSearch } from "#pages/users/model/users-search.ts";
import type { MemberList } from "#shared/contracts/index.ts";

const member = {
  id: "member-1",
  joined: "2026-04",
  name: "山田 花子",
  profile: "本屋めぐりをしています。",
  socialLinks: [],
} as const;

function rendered(list: typeof MemberList.Type, search: UsersSearch): string {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/users" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/users/$id" }),
  ]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/users"] }),
    routeTree,
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <Results list={list} search={search} />
    </RouterContextProvider>,
  );
}

describe("member search results", () => {
  it("offers to clear the filters when nobody matches", () => {
    expect.hasAssertions();
    const html = rendered({ members: [], pageSize: 24, total: 0 }, { keyword: "該当なし" });
    expect(html).toContain("条件に一致するユーザーはいません。");
    expect(html).toContain('href="/users"');
    expect(html).not.toContain("<ul");
  });

  it("links back to the first page with the keyword kept when the page is past the end", () => {
    expect.hasAssertions();
    const html = rendered({ members: [], pageSize: 24, total: 3 }, { keyword: "本屋", page: 5 });
    expect(html).toContain("このページに該当するユーザーはいません。");
    expect(html).toContain(`href="/users?keyword=${encodeURIComponent("本屋")}"`);
    expect(html).toContain("1 ページ目へ");
  });

  it("drops an absent keyword from the first page link", () => {
    expect.hasAssertions();
    const html = rendered({ members: [], pageSize: 24, total: 3 }, { page: 5 });
    expect(html).toContain('href="/users"');
  });

  it("counts the shown range and lists each member on a later page", () => {
    expect.hasAssertions();
    const html = rendered({ members: [member], pageSize: 24, total: 25 }, { page: 2 });
    expect(html).toContain("25 人中 25〜25 人");
    expect(html).toContain('href="/users/member-1"');
    expect(html).toContain(member.name);
  });
});
