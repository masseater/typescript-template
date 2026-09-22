import { assert, describe, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import { HttpResponse, http, type HttpResponseResolver } from "msw";
import { setupServer } from "msw/node";

import { FLAG_KEY } from "./definitions.ts";
import { writeFlag } from "./flagship-write.ts";

const accountId = "a".repeat(32);
const appId = "app-123";
const authToken = Redacted.make("flagship-token-at-least-20-characters");

const flagUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/flagship/apps/${appId}/flags/${FLAG_KEY.memberBoard}`;

describe("flagship write client", () => {
  it.effect("writes a remote flag through the Flagship API shape", () => {
    const rememberWrittenVariation: HttpResponseResolver = ({ request }) =>
      Effect.runPromise(
        Effect.tryPromise(
          (): Promise<{ readonly defaultVariation: string }> =>
            request.json() as Promise<{ readonly defaultVariation: string }>,
        ).pipe(
          Effect.map((requestPayload) =>
            HttpResponse.json({
              result: {
                defaultVariation: requestPayload.defaultVariation,
                enabled: true,
                key: FLAG_KEY.memberBoard,
                variations: { disabled: false, enabled: true },
              },
              success: true,
            }),
          ),
        ),
      );
    return Effect.gen(function* writeRemoteFlag() {
      const flagshipApi = setupServer(
        http.get(flagUrl, () =>
          HttpResponse.json({
            result: {
              defaultVariation: "disabled",
              enabled: true,
              key: FLAG_KEY.memberBoard,
              variations: { disabled: false, enabled: true },
            },
            success: true,
          }),
        ),
        http.put(flagUrl, rememberWrittenVariation),
      );
      flagshipApi.listen({ onUnhandledRequest: "error" });
      const flagshipWrite = yield* Effect.ensuring(
        writeFlag({
          config: { accountId, appId, authToken },
          enabled: true,
          flagKey: FLAG_KEY.memberBoard,
        }),
        Effect.sync(() => {
          flagshipApi.close();
        }),
      );
      assert.deepStrictEqual(flagshipWrite, {
        enabled: true,
        flagKey: FLAG_KEY.memberBoard,
        previous: false,
      });
    });
  });
});
