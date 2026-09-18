import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { remoteExecutor } from "./remote-http.ts";
import { RemoteFailure } from "./remote-input.ts";

const d1Target = {
  accountId: "a".repeat(32),
  apiToken: "test-private-token-at-least-20-characters",
  databaseId: "92b705e4-7b3b-42a9-9de3-700a33fa609c",
};

describe("remoteExecutor", () => {
  describe.for([
    ["a redirect elsewhere", () => HttpResponse.redirect("https://untrusted.example.test/", 302)],
    [
      "an HTTP error that echoes the token",
      () => HttpResponse.json({ error: d1Target.apiToken }, { status: 403 }),
    ],
    [
      "a batch in which a statement failed",
      () =>
        HttpResponse.json({
          result: [{ error: d1Target.apiToken, results: [], success: false }],
          success: true,
        }),
    ],
    ["a body that is not JSON", () => HttpResponse.text(d1Target.apiToken)],
  ] as const)("a D1 API answering with %s", ([, d1Answer]) => {
    const it = test.extend("queryFailure", async ({}, { onCleanup }) => {
      const d1Api = setupServer(
        http.post(
          `https://api.cloudflare.com/client/v4/accounts/${d1Target.accountId}/d1/database/${d1Target.databaseId}/query`,
          d1Answer,
        ),
      );
      d1Api.listen({ onUnhandledRequest: "error" });
      onCleanup(() => {
        d1Api.close();
      });
      return Effect.runPromise(
        Effect.flip(remoteExecutor(d1Target).batch([{ params: [], sql: "SELECT 1" }])),
      );
    });

    it("fails without carrying the provider body or the token", ({ queryFailure }) => {
      expect(queryFailure).toStrictEqual(new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }));
    });
  });
});
