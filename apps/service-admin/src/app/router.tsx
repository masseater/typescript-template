import { loadBrowserSession, sessionQueryClient } from "@repo/auth-ui";
import { createAppRouter } from "@repo/ui/shell";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { deLocalizeUrl, localizeUrl } from "#shared/i18n/index.ts";
import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

const localizedRewrite = {
  input: ({ url }: Readonly<{ url: URL }>) => deLocalizeUrl(url),
  output: ({ url }: Readonly<{ url: URL }>) => localizeUrl(url),
};

function getRouter(): ReturnType<typeof createAppRouter<typeof routeTree>> {
  const queryClient = sessionQueryClient(loadBrowserSession);
  const router = createAppRouter(routeTree, {
    rewrite: localizedRewrite,
    context: { queryClient },
  });
  setupRouterSsrQueryIntegration({ queryClient, router });
  return router;
}

export { getRouter };
