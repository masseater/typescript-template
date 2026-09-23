import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { runRemoteDatabaseCommand } from "../../../../../infra/cloudflare/src/features/cloudflare/remote-command.ts";
import { RemoteFailure } from "./remote-input.ts";

const d1Target = {
  accountId: "a".repeat(32),
  apiToken: "test-private-token-at-least-20-characters",
  databaseId: "22222222-2222-4222-8222-222222222222",
};

describe("the remote database connection", () => {
  describe.for([
    [
      "a redirect elsewhere",
      (): Response => HttpResponse.redirect("https://untrusted.example.test/", 302),
    ],
    [
      "an HTTP error that echoes the token",
      (): Response => HttpResponse.json({ error: d1Target.apiToken }, { status: 403 }),
    ],
    [
      "a batch in which a statement failed",
      (): Response =>
        HttpResponse.json({
          result: [{ error: d1Target.apiToken, results: [], success: false }],
          success: true,
        }),
    ],
    ["a body that is not JSON", (): Response => HttpResponse.text(d1Target.apiToken)],
  ] as const)("a D1 API answering with %s", ([, d1Answer]) => {
    const it = test.extend("queryFailure", ({}, { onCleanup }) => {
      const d1Api = setupServer(
        http.post(
          `https://api.cloudflare.com/client/v4/accounts/${d1Target.accountId}/d1/database/${d1Target.databaseId}/raw`,
          d1Answer,
        ),
      );
      d1Api.listen({ onUnhandledRequest: "error" });
      onCleanup(() => {
        d1Api.close();
      });
      return Effect.runPromise(
        Effect.flip(
          runRemoteDatabaseCommand(
            ["bootstrap", "--execute", "--confirm-database", d1Target.databaseId],
            { ...d1Target, email: "private@example.test" },
          ),
        ),
      );
    });

    it("fails without carrying the provider body or the token", ({ queryFailure }) => {
      expect(queryFailure).toStrictEqual(new RemoteFailure({ code: "REMOTE_QUERY_FAILED" }));
    });
  });
});
