import { assert, describe, it } from "@effect/vitest";
import { httpStatus } from "@repo/config";
import { Effect, Exit } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

import { clientNameOf } from "./consent.ts";

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
