import { HttpResponse, http } from "msw";
import { Effect } from "effect";
import type { HttpResponseResolver } from "msw";
import type { Scope } from "effect";
import type { SetupServer } from "msw/node";
import { assert } from "@effect/vitest";
import { setupServer } from "msw/node";

const INVALID_PAGE_SIZE_STATUS = 400;

function mockServer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ...handlers: Parameters<typeof setupServer>
): Effect.Effect<SetupServer, never, Scope.Scope> {
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
}

function pagedCollection(
  url: string,
  limit: number,
  resolver: HttpResponseResolver,
): ReturnType<typeof http.get> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  function guard(info: Parameters<HttpResponseResolver>[0]): ReturnType<HttpResponseResolver> {
    const requested = new URL(info.request.url).searchParams.get("per_page");
    return requested !== null && Number(requested) > limit
      ? HttpResponse.json(
          { errors: [{ code: 1007, message: "invalid per_page parameter" }], success: false },
          { status: INVALID_PAGE_SIZE_STATUS },
        )
      : resolver(info);
  }
  return http.get(url, guard);
}

function unpagedCollection(
  url: string,
  resolver: HttpResponseResolver,
): ReturnType<typeof http.get> {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  function guard(info: Parameters<HttpResponseResolver>[0]): ReturnType<HttpResponseResolver> {
    assert.isNull(new URL(info.request.url).searchParams.get("per_page"));
    return resolver(info);
  }
  return http.get(url, guard);
}

export { mockServer, pagedCollection, unpagedCollection };
