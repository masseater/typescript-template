import { createRouter, type AnyRoute, type RouterContextOptions } from "@tanstack/react-router";

import { nonceOptions } from "./nonce.ts";
import { NotFoundPage } from "./not-found.tsx";

const createAppRouter = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  routerConfig: RouterContextOptions<TRouteTree> &
    Readonly<{
      rewrite?: Readonly<{
        input: (parts: Readonly<{ url: URL }>) => URL;
        output: (parts: Readonly<{ url: URL }>) => URL;
      }>;
    }>,
): ReturnType<typeof createRouter<TRouteTree>> => {
  const nonce = nonceOptions();
  return createRouter({
    ...routerConfig,
    defaultNotFoundComponent: NotFoundPage,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
    ...(nonce.ssr === undefined ? {} : { ssr: nonce.ssr }),
  });
};

export { createAppRouter };
