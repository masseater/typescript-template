import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { NavigationLink } from "./navigation-link.tsx";

describe("NavigationLink", () => {
  const it = test
    .extend("theSideLinkWithCallerPadding", () => {
      const rootRoute = createRootRoute();
      const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
      const router = createRouter({
        history: createMemoryHistory({ initialEntries: ["/"] }),
        routeTree: rootRoute.addChildren([indexRoute]),
      });
      return renderToStaticMarkup(
        <RouterContextProvider router={router}>
          <NavigationLink className="px-1" to="/" variant="side">
            ホーム
          </NavigationLink>
        </RouterContextProvider>,
      );
    })
    .extend("thePlainSideLink", () => {
      const rootRoute = createRootRoute();
      const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
      const router = createRouter({
        history: createMemoryHistory({ initialEntries: ["/"] }),
        routeTree: rootRoute.addChildren([indexRoute]),
      });
      return renderToStaticMarkup(
        <RouterContextProvider router={router}>
          <NavigationLink to="/" variant="side">
            ホーム
          </NavigationLink>
        </RouterContextProvider>,
      );
    });

  it("merges caller spacing and keeps the side link's other classes", ({
    theSideLinkWithCallerPadding,
  }) => {
    expect.hasAssertions();
    expect(theSideLinkWithCallerPadding).toMatchInlineSnapshot(
      `"<a href="/" data-status="active" aria-current="page" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground px-1 active">ホーム</a>"`,
    );
  });

  it("keeps the side padding when the caller passes no class", ({ thePlainSideLink }) => {
    expect.hasAssertions();
    expect(thePlainSideLink).toMatchInlineSnapshot(
      `"<a href="/" data-status="active" aria-current="page" data-slot="navigation-link" class="rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator block px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:hover:bg-primary aria-[current=page]:hover:text-primary-foreground active">ホーム</a>"`,
    );
  });
});
