import { assert, describe, it } from "@effect/vitest";
import { httpStatus } from "@repo/config";
import { QueryClient } from "@tanstack/react-query";
import { Effect, Exit } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { expect } from "vite-plus/test";

import { clientNameOf, clientNameOptions } from "./consent.ts";

function responseOf(body: string, status: number): HttpClientResponse.HttpClientResponse {
  return HttpClientResponse.fromWeb(
    HttpClientRequest.get("https://wiki.example/api/auth/oauth2/public-client"),
    new Response(body, { headers: { "content-type": "application/json" }, status }),
  );
}

describe("clientNameOf", () => {
  it.effect("shows the registered client name", () =>
    Effect.gen(function* program() {
      assert.strictEqual(
        yield* clientNameOf("client-1", responseOf('{"client_name":"社内ツール"}', httpStatus.ok)),
        "社内ツール",
      );
    }),
  );

  it.effect("falls back to the client id when the client has no name", () =>
    Effect.gen(function* program() {
      assert.strictEqual(
        yield* clientNameOf("client-1", responseOf("{}", httpStatus.ok)),
        "client-1",
      );
    }),
  );

  it.effect("fails when the client lookup is rejected", () =>
    Effect.gen(function* program() {
      const exit = yield* Effect.exit(
        clientNameOf("client-1", responseOf("{}", httpStatus.notFound)),
      );
      assert.isTrue(Exit.isFailure(exit));
    }),
  );
});

describe("oauth client name queries", () => {
  it("keeps each client name on its own key", () => {
    expect.hasAssertions();
    const client = new QueryClient();
    const ada = clientNameOptions("ada");
    const bob = clientNameOptions("bob");
    client.setQueryData(ada.queryKey, "Ada");
    client.setQueryData(bob.queryKey, "Bob");
    return client.invalidateQueries({ queryKey: ada.queryKey }).then(() => {
      expect(client.getQueryState(ada.queryKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(bob.queryKey)?.isInvalidated).toBe(false);
      expect(client.getQueryData(bob.queryKey)).toBe("Bob");
    });
  });
});
