import type { Router } from "@tanstack/react-router";
import { createRouter } from "@tanstack/react-router";

import { nonceOptions } from "@repo/ui/shell";

import { routeTree } from "./routeTree.gen";

type WikiRouter = Router<typeof routeTree>;

function getRouter(): WikiRouter {
  return createRouter({
    defaultNotFoundComponent: () => <p>ページが見つかりません。</p>,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
    ...nonceOptions(),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: WikiRouter;
  }
}

export { getRouter };
