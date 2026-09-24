import { cspNonceHeader } from "@repo/runtime/security";
import { createRootRoute } from "@tanstack/react-router";
import { requestHandler } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { createAppRouter } from "./app-router.ts";
import { NotFoundPage } from "./not-found.tsx";

describe("app router", () => {
  const it = test.extend("theRouterOptions", () =>
    Effect.runPromise(
      Effect.forEach(
        [
          { headers: {}, routerConfig: undefined },
          {
            headers: { [cspNonceHeader]: "request-nonce" },
            routerConfig: {
              rewrite: {
                input: ({ url }: Readonly<{ url: URL }>): URL =>
                  new URL(url.pathname.replace(/^\/en/u, ""), url.origin),
                output: ({ url }: Readonly<{ url: URL }>): URL =>
                  new URL(`/en${url.pathname}`, url.origin),
              },
              routerContext: { tenant: "example" },
            },
          },
        ],
        ({ headers, routerConfig }) =>
          Effect.promise(() =>
            Promise.resolve(
              requestHandler(() => {
                const { options } = createAppRouter(createRootRoute(), routerConfig);
                return Response.json({
                  context: options.context,
                  defaultNotFoundComponent: options.defaultNotFoundComponent === NotFoundPage,
                  defaultPreloadStaleTime: options.defaultPreloadStaleTime,
                  input: options.rewrite
                    ?.input?.({
                      url: new URL("https://example.com/en/members"),
                    })
                    ?.toString(),
                  output: options.rewrite
                    ?.output?.({ url: new URL("https://example.com/members") })
                    ?.toString(),
                  scrollRestoration: options.scrollRestoration,
                  ssr: options.ssr,
                });
              })(new Request("https://example.com/", { headers }), {}),
            ),
          ).pipe(Effect.flatMap((served) => Effect.promise(() => served.json()))),
      ),
    ));

  it("adds the context, the rewrite and the nonce only when given", ({ theRouterOptions }) => {
    expect.hasAssertions();
    expect(theRouterOptions).toStrictEqual([
      {
        defaultNotFoundComponent: true,
        defaultPreloadStaleTime: 0,
        scrollRestoration: true,
      },
      {
        context: { tenant: "example" },
        defaultNotFoundComponent: true,
        defaultPreloadStaleTime: 0,
        input: "https://example.com/members",
        output: "https://example.com/en/members",
        scrollRestoration: true,
        ssr: { nonce: "request-nonce" },
      },
    ]);
  });
});
