import { createRouter, type AnyRoute } from "@tanstack/react-router";

import { nonceOptions } from "./nonce.ts";
import { NotFoundPage } from "./not-found.tsx";

type AppRouterRewrite = Readonly<{
  input: (parts: Readonly<{ url: URL }>) => URL;
  output: (parts: Readonly<{ url: URL }>) => URL;
}>;

type CreateAppRouterOptions = Readonly<{
  rewrite?: AppRouterRewrite;
  routerContext?: object;
}>;

const createAppRouter = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  routerConfig?: CreateAppRouterOptions,
): ReturnType<typeof createRouter<TRouteTree>> => {
  const nonce = nonceOptions();
  const router = {
    defaultNotFoundComponent: NotFoundPage,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true as const,
    ...(routerConfig?.routerContext === undefined ? {} : { context: routerConfig.routerContext }),
    ...(routerConfig?.rewrite === undefined ? {} : { rewrite: routerConfig.rewrite }),
    ...(nonce.ssr === undefined ? {} : { ssr: nonce.ssr }),
  };
  return createRouter(router as Parameters<typeof createRouter<TRouteTree>>[0]);
};

export { createAppRouter };
