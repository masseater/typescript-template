import { loadBrowserSession, provideSessionLoader } from "@repo/auth-ui/session";
import { wikiBasePath } from "@repo/config";
import { createAppRouter } from "@repo/ui/shell";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

const wikiRoot = `${wikiBasePath}/`;

function withPathname(url: URL, pathname: string): URL {
  const moved = new URL(url);
  moved.pathname = pathname;
  return moved;
}

const rootSlash = {
  input: ({ url }: Readonly<{ url: URL }>): URL =>
    url.pathname === wikiRoot ? withPathname(url, wikiBasePath) : url,
  output: ({ url }: Readonly<{ url: URL }>): URL =>
    url.pathname === wikiBasePath ? withPathname(url, wikiRoot) : url,
};

function getRouter(): ReturnType<typeof createAppRouter<typeof routeTree>> {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { networkMode: "always" }, queries: { networkMode: "always" } },
  });
  provideSessionLoader(queryClient, loadBrowserSession);
  const router = createAppRouter(routeTree, { rewrite: rootSlash, routerContext: { queryClient } });
  setupRouterSsrQueryIntegration({ queryClient, router });
  return router;
}

export { getRouter };
