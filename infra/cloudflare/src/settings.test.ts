import { assert, it } from "@effect/vitest";
import { Effect, Redacted, Schema } from "effect";
import { ConfigProvider, fromDotEnvContents } from "effect/ConfigProvider";

import { AuthSecret, Origin, Prefix, SharedSettings, checkSharedConfig } from "./config.ts";
import { describeFailure } from "./secrets.ts";
import { authSecret, settings as deploymentSettings } from "./settings.ts";
import {
  verificationAuthSecret,
  verificationEnvironment,
  verificationSettings,
} from "./verification-fixture.ts";

const settings = verificationSettings;

function environment(
  overrides: Readonly<Record<string, string | undefined>>,
): ReturnType<typeof fromDotEnvContents> {
  return fromDotEnvContents(
    Object.entries({ ...verificationEnvironment, ...overrides })
      .flatMap(([key, value]) => (value === undefined ? [] : [`${key}=${value}`]))
      .join("\n"),
  );
}

function rejects(schema: Schema.Codec<unknown, unknown>, value: unknown): Effect.Effect<void> {
  return Schema.decodeUnknownEffect(schema)(value).pipe(Effect.flip, Effect.asVoid, Effect.orDie);
}

for (const origin of [
  "http://admin.example.com",
  "https://admin.example.com/path",
  "https://admin.example.com/",
  "https://admin.example.com?x=1",
  "https://app.example.workers.dev",
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
      fromDotEnvContents(`TEMPLATE_AUTH_SECRET=${verificationAuthSecret}\n`),
    );
    assert.isTrue(Redacted.isRedacted(secret));
    assert.strictEqual(Redacted.value(secret), verificationAuthSecret);
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
    assert.deepStrictEqual(
      [...failure.keys],
      ["TEMPLATE_SERVICE_ADMIN_ORIGIN", "TEMPLATE_SERVICE_MEMBER_ORIGIN"],
    );
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

it.effect("refuses a sender address outside the subdomain named by the prefix", () =>
  Effect.forEach(
    ["mail@example.com", "mail@send.example.com", `mail@${settings.prefix}x.example.com`],
    (mailFrom) =>
      Effect.gen(function* program() {
        const config = yield* Schema.decodeUnknownEffect(SharedSettings)({ ...settings, mailFrom });
        const failure = yield* checkSharedConfig(config).pipe(Effect.flip);
        assert.strictEqual(failure.code, "mail_from_outside_deployment");
        assert.deepStrictEqual([...failure.keys], ["TEMPLATE_MAIL_FROM", "TEMPLATE_PREFIX"]);
        assert.notInclude(JSON.stringify(failure), mailFrom);
      }),
  ),
);

it.effect("accepts a sender address on the subdomain named by the prefix", () =>
  Effect.gen(function* program() {
    const config = yield* Schema.decodeUnknownEffect(SharedSettings)(settings);
    assert.strictEqual((yield* checkSharedConfig(config)).mailFrom, settings.mailFrom);
  }),
);

it.effect("refuses an OTLP switch that has no endpoint to switch", () =>
  Effect.forEach(["true", "false"], (enabled) =>
    Effect.gen(function* program() {
      const failure = yield* Effect.provideService(
        deploymentSettings,
        ConfigProvider,
        environment({ TEMPLATE_OTLP_ENABLED: enabled, TEMPLATE_OTLP_ENDPOINT: undefined }),
      ).pipe(Effect.flip);
      assert.deepStrictEqual(describeFailure(failure, []), {
        code: "otlp_enabled_without_endpoint",
        keys: ["TEMPLATE_OTLP_ENABLED", "TEMPLATE_OTLP_ENDPOINT"],
      });
    }),
  ),
);

it.effect("leaves OTLP unconfigured when neither the endpoint nor the switch is given", () =>
  Effect.gen(function* program() {
    const config = yield* Effect.provideService(
      deploymentSettings,
      ConfigProvider,
      environment({ TEMPLATE_OTLP_ENABLED: undefined, TEMPLATE_OTLP_ENDPOINT: undefined }),
    );
    assert.isUndefined(config.otlp);
  }),
);

it.effect("an endpoint without the switch keeps OTLP enabled", () =>
  Effect.gen(function* program() {
    const config = yield* Effect.provideService(
      deploymentSettings,
      ConfigProvider,
      environment({ TEMPLATE_OTLP_ENABLED: undefined }),
    );
    assert.deepStrictEqual(config.otlp, { enabled: true, endpoint: settings.otlp.endpoint });
  }),
);

it.effect("the settings every command reads carry the shared checks", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      (yield* Effect.provideService(deploymentSettings, ConfigProvider, environment({}))).mailFrom,
      settings.mailFrom,
    );
    const failure = yield* Effect.provideService(
      deploymentSettings,
      ConfigProvider,
      environment({ TEMPLATE_MAIL_FROM: "mail@example.com" }),
    ).pipe(Effect.flip);
    assert.deepStrictEqual(describeFailure(failure, []), {
      code: "mail_from_outside_deployment",
      keys: ["TEMPLATE_MAIL_FROM", "TEMPLATE_PREFIX"],
    });
  }),
);
