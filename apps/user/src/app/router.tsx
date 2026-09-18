import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { withServerQueries } from "@template/ui/shell";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

function getRouter(): ReturnType<typeof createRouter<typeof routeTree>> {
  return withServerQueries(
    createRouter({
      defaultNotFoundComponent: () => <p>ページが見つかりません。</p>,
      defaultPreloadStaleTime: 0,
      routeTree,
      scrollRestoration: true,
    }),
  );
}

export { getRouter };
