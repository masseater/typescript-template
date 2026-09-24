import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { memberPageSize } from "#shared/contracts/index.ts";
import { ResultList } from "./result-list.tsx";

import type { MemberView } from "#shared/contracts/index.ts";

type Member = typeof MemberView.Type;

function member(index: number): Member {
  return {
    id: `member-${String(index)}`,
    joined: "2026-04",
    name: `利用者 ${String(index)}`,
    photos: { company: null, face: null },
    profile: "本屋めぐりをしています。",
    profileLayout: { blocks: [] },
    sheet: {},
    socialLinks: [],
  };
}

function rendered(members: readonly Member[], total: number): string {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/search" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/users/$id" }),
  ]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/search"] }),
    routeTree,
  });
  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <ResultList
        fetchNextPage={() => Promise.resolve()}
        hasNextPage={members.length < total}
        isFetchingNextPage={false}
        members={members}
        total={total}
      />
    </RouterContextProvider>,
  );
}

describe("member search results", () => {
  it("offers to clear the filters when nobody matches", () => {
    expect.hasAssertions();
    const html = rendered([], 0);
    expect(html).toContain("条件に一致する利用者はいません。");
    expect(html).toContain('href="/search"');
    expect(html).not.toContain("<ul");
  });

  it("counts the loaded members and marks that more are still to come", () => {
    expect.hasAssertions();
    const html = rendered([member(1)], 25);
    expect(html).toContain("25 人中 1〜1 人（読み込み中の分を含む）");
    expect(html).toContain('href="/users/member-1"');
    expect(html).toContain("利用者 1");
  });

  it("renders only the first page before the virtual grid takes over", () => {
    expect.hasAssertions();
    const members = Array.from({ length: memberPageSize + 1 }, (_, index) => member(index));
    const html = rendered(members, members.length);
    expect(html).toContain(`${String(members.length)} 人中 1〜${String(members.length)} 人`);
    expect(html).not.toContain("読み込み中の分を含む");
    expect(html.match(/<li>/gu)).toHaveLength(memberPageSize);
  });
});
