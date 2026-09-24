import { loadBrowserSession, sessionQueryClient } from "@repo/auth-ui";
import { createAppRouter } from "@repo/ui/shell";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

function getRouter(): ReturnType<typeof createAppRouter<typeof routeTree>> {
  const queryClient = sessionQueryClient(loadBrowserSession);
  const router = createAppRouter(routeTree, { routerContext: { queryClient } });
  setupRouterSsrQueryIntegration({ queryClient, router });
  return router;
}

export { getRouter };
