import { DbClient } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

const staleTime = 30_000;

function getRouter(): ReturnType<typeof createRouter<typeof routeTree>> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime } } });
  const router = createRouter({
    context: { dbClient: new DbClient({ queryClient }), queryClient },
    defaultNotFoundComponent: () => <p>ページが見つかりません。</p>,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
  });
  setupRouterSsrQueryIntegration({ queryClient, router });
  return router;
}

export { getRouter };
