import { nonceOptions } from "@repo/ui/shell";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

function getRouter(): ReturnType<typeof createRouter<typeof routeTree>> {
  return createRouter({
    defaultNotFoundComponent: () => <p>ページが見つかりません。</p>,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
    ...nonceOptions(),
  });
}

export { getRouter };
