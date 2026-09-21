import { assert, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import { Effect } from "effect";

import { appEnvironment, fixtureAuthSecret } from "./app-fixture.ts";
import { readWorkerConfig } from "./bindings.ts";

const model = {
  gateway: (): object => ({}),
  models: (): Promise<readonly []> => Promise.resolve([]),
  run: (): Promise<object> => Promise.resolve({}),
};

it.effect("reads D1, the auth secret, and email from the effect-cf bindings layer", () =>
  Effect.gen(function* program() {
    const config = yield* readWorkerConfig(appEnvironment());
    assert.strictEqual(config.DB, env.DB);
    assert.strictEqual(typeof config.EMAIL?.send, "function");
    assert.strictEqual(config.AUTH_SECRET, fixtureAuthSecret);
    assert.isUndefined(config.AI);
  }),
);

it.effect("keeps the real D1 binding when an AI layer is added beside it", () =>
  Effect.gen(function* program() {
    const ai: unknown = model;
    const config = yield* readWorkerConfig(appEnvironment({ AI: ai }));
    assert.strictEqual(Object.is(config.AI, model), true);
    assert.strictEqual(config.DB, env.DB);
  }),
);

it.effect("names a missing database and a missing mail binding", () =>
  Effect.gen(function* program() {
    const missingDatabase = yield* readWorkerConfig(appEnvironment({ DB: undefined })).pipe(
      Effect.flip,
    );
    assert.strictEqual(missingDatabase._tag, "ConfigurationInvalid");
    assert.include(missingDatabase.reason, "DB");
    const missingMail = yield* readWorkerConfig(appEnvironment({ EMAIL: undefined })).pipe(
      Effect.flip,
    );
    assert.strictEqual(missingMail.reason, "An email delivery binding is required");
  }),
);
