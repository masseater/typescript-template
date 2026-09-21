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

import { ChoosePage } from "./choose-page.tsx";

function rendered(): string {
  const rootRoute = createRootRoute();
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/welcome/profile" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/welcome/interview" }),
  ]);
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/welcome/choose"] }),
    routeTree,
  });
  return renderToStaticMarkup(
    createElement(RouterContextProvider, {
      children: createElement(ChoosePage),
      router,
    }),
  );
}

describe("choose how to fill the page", () => {
  it("puts the interview on the member page and keeps manual entry beside it", () => {
    expect.hasAssertions();
    const html = rendered();
    const pageAt = html.indexOf('data-slot="member-page"');
    const pageEnd = html.indexOf("</article>", pageAt);
    const page = html.slice(pageAt, pageEnd);
    expect(page).toContain("h-24");
    expect(page).toContain("-mt-10");
    expect(page).toContain("AI にインタビューしてもらう");
    expect(page).not.toContain("自分で入力する");
    expect(html.slice(pageEnd)).toContain("自分で入力する");
  });
});
