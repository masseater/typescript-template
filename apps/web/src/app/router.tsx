import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import type { Router } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createIsomorphicFn, getGlobalStartContext } from "@tanstack/react-start";
import { Option } from "effect";

import { routeTree } from "./routeTree.gen";

type AppRouter = Router<typeof routeTree>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

const ssrOf = createIsomorphicFn()
  .server(() =>
    Option.match(Option.fromNullishOr(getGlobalStartContext()), {
      onNone: () => ({}),
      onSome: ({ nonce }) => ({ nonce }),
    }),
  )
  .client(() => ({}));

const getRouter = (): AppRouter => {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    ssr: ssrOf(),
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
};

export type { AppRouter };
export { getRouter };
