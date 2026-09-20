import { createRouter, type AnyRoute } from "@tanstack/react-router";

import { nonceOptions } from "./nonce.ts";
import { NotFoundPage } from "./not-found.tsx";

const createAppRouter = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  routerContext?: NonNullable<Parameters<typeof createRouter<TRouteTree>>[0]["context"]>,
): ReturnType<typeof createRouter<TRouteTree>> => {
  const nonce = nonceOptions();
  const router = {
    defaultNotFoundComponent: NotFoundPage,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true as const,
    ...(routerContext === undefined ? {} : { context: routerContext }),
    ...(nonce.ssr === undefined ? {} : { ssr: nonce.ssr }),
  };
  return createRouter(router as Parameters<typeof createRouter<TRouteTree>>[0]);
};

export { createAppRouter };
