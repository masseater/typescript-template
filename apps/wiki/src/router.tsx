import { NotFound } from "./components/not-found.tsx";
import type { Router } from "@tanstack/react-router";
import type { StartRequestContext } from "@template/runtime/worker";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

type WikiRouter = Router<typeof routeTree>;

function getRouter(): WikiRouter {
  return createRouter({
    defaultNotFoundComponent: NotFound,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: WikiRouter;
    server: { requestContext: StartRequestContext };
  }
}

export { getRouter };
