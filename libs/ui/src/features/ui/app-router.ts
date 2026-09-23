import { createRouter, type AnyRoute } from "@tanstack/react-router";
import { Option } from "effect";

import { nonceOptions } from "./nonce.ts";
import { NotFoundPage } from "./not-found.tsx";

const createAppRouter = <TRouteTree extends AnyRoute>(
  routeTree: TRouteTree,
  routerConfig?: Readonly<{
    rewrite?: Readonly<{
      input: (parts: Readonly<{ url: URL }>) => URL;
      output: (parts: Readonly<{ url: URL }>) => URL;
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
    ...(routerConfig?.rewrite === undefined ? {} : { rewrite: routerConfig.rewrite }),
    ...(nonce.ssr === undefined ? {} : { ssr: nonce.ssr }),
  };
  return createRouter(router as Parameters<typeof createRouter<TRouteTree>>[0]);
};

const searchValidator =
  <Search>(
    decode: (raw: unknown) => Option.Option<Search>,
    invalid: () => Error,
  ): ((raw: unknown) => Search) =>
  (raw) =>
    Option.getOrThrowWith(decode(raw), invalid);

export { createAppRouter, searchValidator };
