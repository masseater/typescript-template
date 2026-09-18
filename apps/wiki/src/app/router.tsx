import { createRouter, type Router } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

type WikiRouter = Router<typeof routeTree>;

declare module "@tanstack/react-router" {
  interface Register {
    router: WikiRouter;
  }
}

const getRouter = (): WikiRouter => {
  return createRouter({
    defaultNotFoundComponent: () => <p>ページが見つかりません。</p>,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
  });
};

export { getRouter };
