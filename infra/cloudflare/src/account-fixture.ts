import { assert } from "@effect/vitest";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

import type { Scope } from "effect";
import type { HttpResponseResolver } from "msw";
import type { SetupServer } from "msw/node";

const mockServer = (
  ...handlers: Parameters<typeof setupServer>
): Effect.Effect<SetupServer, never, Scope.Scope> => {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const server = setupServer(...handlers);
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),

    (server) =>
      Effect.sync(() => {
        server.close();
      }),
  );
};

const INVALID_PAGE_SIZE_STATUS = 400;

const pagedCollection = (
  url: string,
  limit: number,
  resolver: HttpResponseResolver,
): ReturnType<typeof http.get> => {
  const guard = (info: Parameters<HttpResponseResolver>[0]): ReturnType<HttpResponseResolver> => {
    const requested = new URL(info.request.url).searchParams.get("per_page");
    return requested !== null && Number(requested) > limit
      ? HttpResponse.json(
          { errors: [{ code: 1007, message: "invalid per_page parameter" }], success: false },
          { status: INVALID_PAGE_SIZE_STATUS },
        )
      : resolver(info);
  };
  return http.get(url, guard);
};

const unpagedCollection = (
  url: string,
  resolver: HttpResponseResolver,
): ReturnType<typeof http.get> => {
  const guard = (info: Parameters<HttpResponseResolver>[0]): ReturnType<HttpResponseResolver> => {
    assert.isNull(new URL(info.request.url).searchParams.get("per_page"));
    return resolver(info);
  };
  return http.get(url, guard);
};

export { mockServer, pagedCollection, unpagedCollection };
