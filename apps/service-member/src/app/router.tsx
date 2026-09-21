import { createAppRouter } from "@repo/ui/shell";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { deLocalizeUrl, localizeUrl } from "#shared/i18n/index.ts";
import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

function getRouter(): ReturnType<typeof createAppRouter<typeof routeTree>> {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { networkMode: "always" }, queries: { networkMode: "always" } },
  });
  const router = createAppRouter(routeTree, {
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
    routerContext: { queryClient },
  });
  setupRouterSsrQueryIntegration({ queryClient, router });
  return router;
}

export { getRouter };
