import { createRouter, type AnyRoute } from "@tanstack/react-router";

import { nonceOptions } from "./nonce.ts";
import { NotFoundPage } from "./not-found.tsx";

const localizedRewrite = ({
  deLocalizeUrl,
  localizeUrl,
}: Readonly<{ deLocalizeUrl: (url: URL) => URL; localizeUrl: (url: URL) => URL }>): Readonly<{
  input: (parts: Readonly<{ url: URL }>) => URL;
  output: (parts: Readonly<{ url: URL }>) => URL;
}> => ({
  input: ({ url }) => deLocalizeUrl(url),
  output: ({ url }) => localizeUrl(url),
});

const createAppRouter = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  routerConfig?: Readonly<{
    localizedUrls?: Readonly<{
      deLocalizeUrl: (url: URL) => URL;
      localizeUrl: (url: URL) => URL;
    }>;
    routerContext?: object;
  }>,
): ReturnType<typeof createRouter<TRouteTree>> => {
  const nonce = nonceOptions();
  const router = {
    defaultNotFoundComponent: NotFoundPage,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true as const,
    ...(routerConfig?.routerContext === undefined ? {} : { context: routerConfig.routerContext }),
    ...(routerConfig?.localizedUrls === undefined
      ? {}
      : { rewrite: localizedRewrite(routerConfig.localizedUrls) }),
    ...(nonce.ssr === undefined ? {} : { ssr: nonce.ssr }),
  };
  return createRouter(router as Parameters<typeof createRouter<TRouteTree>>[0]);
};

export { createAppRouter };
