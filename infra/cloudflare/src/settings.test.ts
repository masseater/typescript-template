import { assert, it } from "@effect/vitest";
import { Effect, Redacted, Schema } from "effect";
import { ConfigProvider, fromDotEnvContents } from "effect/ConfigProvider";

import { AuthSecret, Origin, Prefix, SharedSettings, checkSharedConfig } from "./config.ts";
import { describeFailure } from "./secrets.ts";
import { authSecret } from "./settings.ts";
import { verificationSettings } from "./verification-fixture.ts";

const accepted = "vrf-3kQ8pZ2mL9xT6bN1hJ4sD7gW0yC5e";
const settings = verificationSettings;

function rejects(schema: Schema.Codec<unknown, unknown>, value: unknown): Effect.Effect<void> {
  return Schema.decodeUnknownEffect(schema)(value).pipe(Effect.flip, Effect.asVoid, Effect.orDie);
}

for (const origin of [
  "http://admin.example.com",
  "https://admin.example.com/path",
  "https://admin.example.com/",
  "https://admin.example.com?x=1",
  "https://app.team.workers.dev",
  "not-a-url",
]) {
  it.effect(`rejects unsafe origin ${origin}`, () => rejects(Origin, origin));
}

for (const prefix of ["Upper", "1leading", "ab", "has_underscore", "-leading"]) {
  it.effect(`rejects unusable prefix ${prefix}`, () => rejects(Prefix, prefix));
}

it.effect("a rejected deployment input names its key without repeating its value", () =>
  Effect.gen(function* program() {
    const failure = yield* Effect.provideService(
      authSecret,
      ConfigProvider,
      fromDotEnvContents("TEMPLATE_AUTH_SECRET=too-short\n"),
    ).pipe(Effect.flip);
    const described = JSON.stringify(describeFailure(failure, []));
    assert.include(described, "TEMPLATE_AUTH_SECRET");
    assert.notInclude(described, "too-short");
  }),
);

const weakSecrets = [
  "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "abababababababababababababababab",
  "                                        ",
];

for (const weak of weakSecrets) {
  it.effect(`rejects a low-variety auth secret of length ${weak.length}`, () =>
    rejects(AuthSecret, weak),
  );
}

it.effect("the accepted secret stays redacted", () =>
  Effect.gen(function* program() {
    const secret = yield* Effect.provideService(
      authSecret,
      ConfigProvider,
      fromDotEnvContents(`TEMPLATE_AUTH_SECRET=${accepted}\n`),
    );
    assert.isTrue(Redacted.isRedacted(secret));
    assert.strictEqual(Redacted.value(secret), accepted);
  }),
);

it.effect("names the origins that collide instead of the values", () =>
  Effect.gen(function* program() {
    const config = yield* Schema.decodeUnknownEffect(SharedSettings)({
      ...settings,
      origins: { ...settings.origins, admin: settings.origins.user },
    });
    const failure = yield* checkSharedConfig(config).pipe(Effect.flip);
    assert.strictEqual(failure.code, "app_origins_must_differ");
    assert.deepStrictEqual([...failure.keys], ["TEMPLATE_ADMIN_ORIGIN", "TEMPLATE_USER_ORIGIN"]);
    assert.notInclude(JSON.stringify(failure), settings.origins.user);
  }),
);

it.effect("refuses a budget exhausted by fixed fees and names the keys", () =>
  Effect.gen(function* program() {
    const config = yield* Schema.decodeUnknownEffect(SharedSettings)({
      ...settings,
      budget: { ...settings.budget, fixedCostUsd: 50 },
    });
    const failure = yield* checkSharedConfig(config).pipe(Effect.flip);
    assert.strictEqual(failure.code, "budget_has_no_usage_allowance");
    assert.include([...failure.keys], "BUDGET_JPY");
  }),
);
