import type { Router } from "@tanstack/react-router";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { withServerQueries } from "@template/ui/shell";

type WikiRouter = Router<typeof routeTree>;

function getRouter(): WikiRouter {
  return withServerQueries(
    createRouter({
      defaultNotFoundComponent: () => <p>ページが見つかりません。</p>,
      defaultPreloadStaleTime: 0,
      routeTree,
      scrollRestoration: true,
    }),
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: WikiRouter;
  }
}

export { getRouter };
