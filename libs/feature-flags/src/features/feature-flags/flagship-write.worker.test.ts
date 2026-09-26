import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { Effect, Redacted, Ref, Schema } from "effect";
import { HttpResponse, http } from "msw";

import { FlagshipWriteConfig, writeFlag } from "./flagship-write.ts";

const config = FlagshipWriteConfig.make({
  accountId: "account",
  appId: "app",
  authToken: Redacted.make("flagship-write-token"),
});
const flagKey = "checkout";
const flagUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/flagship/apps/${config.appId}/flags/${flagKey}`;
const liveFlag = {
  default_variation: "enabled",
  description: "set by the declaration",
  enabled: true,
  key: flagKey,
  rules: [{ conditions: [], priority: 1, serve_variation: "enabled" }],
  type: "boolean",
  variations: { disabled: false, enabled: true },
};

const WrittenBody = Schema.Record(Schema.String, Schema.Unknown);

it.effect("changes only the default variation of the live flag", () =>
  Effect.gen(function* program() {
    const written = yield* Ref.make<readonly unknown[]>([]);
    const services = yield* Effect.context();
    const network = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const started = setupNetwork();
        started.configure({ onUnhandledFrame: "error" });
        started.use(
          http.get(flagUrl, () => HttpResponse.json({ result: liveFlag, success: true })),
          http.put(flagUrl, ({ request }) =>
            Effect.runPromiseWith(services)(
              Effect.gen(function* recordWrite() {
                const body = Schema.decodeUnknownSync(WrittenBody)(
                  yield* Effect.promise(() => request.json()),
                );
                yield* Ref.update(written, (earlier) => [...earlier, body]);
                return HttpResponse.json({ result: { ...liveFlag, ...body }, success: true });
              }),
            ),
          ),
        );
        started.enable();
        return started;
      }),
      (started) =>
        Effect.sync(() => {
          started.disable();
        }),
    );
    assert.isDefined(network);
    const toggled = yield* writeFlag({ config, enabled: false, flagKey });
    assert.deepStrictEqual(toggled, { enabled: false, flagKey, previous: true });
    const { type: _serverInferred, ...declared } = liveFlag;
    assert.deepStrictEqual(yield* Ref.get(written), [
      { ...declared, default_variation: "disabled" },
    ]);
  }).pipe(Effect.scoped),
);
