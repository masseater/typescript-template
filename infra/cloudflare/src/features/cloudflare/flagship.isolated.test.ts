import { assert, it } from "@effect/vitest";
import { Stack, inMemoryState } from "alchemy";
import { Flagship } from "alchemy/Cloudflare";
import { deploy, toEffect } from "alchemy/Test/Core";
import { Effect, Ref, Schema } from "effect";
import { HttpResponse, http } from "msw";

import { mockServer } from "./account-test-fixture.ts";
import { applyVerificationEnvironment } from "./inventory.ts";
import { stackProviders } from "./stacks.ts";
import { verificationSettings } from "./verification-settings.ts";

applyVerificationEnvironment();
process.env["DO_NOT_TRACK"] = "1";

const appId = "flagship-app";
const flagKey = "checkout";
const flagUrl = `https://api.cloudflare.com/client/v4/accounts/${verificationSettings.accountId}/flagship/apps/${appId}/flags/${flagKey}`;

const liveFlag = {
  default_variation: "enabled",
  description: "before",
  enabled: true,
  key: flagKey,
  rules: [],
  type: "boolean",
  variations: { disabled: false, enabled: true },
};

const WrittenBody = Schema.Record(Schema.String, Schema.Unknown);

const flagshipApi = Effect.fn("flagshipApi")(function* flagshipApi() {
  const written = yield* Ref.make<readonly Readonly<Record<string, unknown>>[]>([]);
  const services = yield* Effect.context();
  yield* mockServer(
    http.get(flagUrl, () =>
      HttpResponse.json({ errors: [], messages: [], result: liveFlag, success: true }),
    ),
    http.put(flagUrl, ({ request }) =>
      Effect.runPromiseWith(services)(
        Effect.gen(function* recordWrite() {
          const body = Schema.decodeUnknownSync(WrittenBody)(
            yield* Effect.promise(() => request.json()),
          );
          yield* Ref.update(written, (earlier) => [...earlier, body]);
          return HttpResponse.json({
            errors: [],
            messages: [],
            result: { ...liveFlag, ...body },
            success: true,
          });
        }),
      ),
    ),
  );
  return written;
});

it.effect("keeps the default variation the dashboard chose when a deploy changes the flag", () =>
  Effect.gen(function* program() {
    const written = yield* flagshipApi();
    const options = { providers: stackProviders, state: inMemoryState() };
    yield* toEffect(
      deploy(
        options,
        Stack(
          "flagship-owner",
          options,
          Effect.gen(function* flags() {
            yield* Flagship.Flag(`Flag-${flagKey}`, {
              appId,
              defaultVariation: "disabled",
              description: "after",
              enabled: true,
              key: flagKey,
              retainLiveDefaultVariation: true,
              variations: { disabled: false, enabled: true },
            });
          }),
        ),
        { stage: verificationSettings.prefix },
      ),
      options,
    );
    const writes = yield* Ref.get(written);
    assert.deepStrictEqual(
      writes.map((body) => [body["description"], body["default_variation"]]),
      [["after", "enabled"]],
    );
  }).pipe(Effect.scoped),
);
