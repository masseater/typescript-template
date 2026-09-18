import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { nonceOptions } from "@repo/ui/shell";

import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

function getRouter(): ReturnType<typeof createRouter<typeof routeTree>> {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { networkMode: "always" }, queries: { networkMode: "always" } },
  });
  const router = createRouter({
    context: { queryClient },
    defaultNotFoundComponent: () => <p>ページが見つかりません。</p>,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
    ...nonceOptions(),
  });
  setupRouterSsrQueryIntegration({ queryClient, router });
  return router;
}

export { getRouter };
