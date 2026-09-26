import { assert, it } from "@effect/vitest";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { STRIPE_API_KEY_ENV } from "alchemy/Stripe";
import { Effect, Redacted, Schema } from "effect";
import { ConfigProvider, fromDotEnvContents } from "effect/ConfigProvider";

import {
  AuthSecret,
  Domain,
  Origin,
  Prefix,
  SharedSettings,
  checkSharedConfig,
  deriveOrigins,
} from "./config.ts";
import { encodeJson } from "./platform.ts";
import { describeFailure } from "./secrets.ts";
import { authSecret, settings as deploymentSettings, stripeSandboxKey } from "./settings.ts";
import {
  verificationAuthSecret,
  verificationEnvironment,
  verificationSettings,
} from "./verification-settings.ts";

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
    const described = yield* encodeJson(describeFailure(failure, []));
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

for (const domain of ["", "example.com/path", "localhost", "Example.com", "app.workers.dev"]) {
  it.effect(`rejects unusable base domain ${domain}`, () => rejects(Domain, domain));
}

it.effect("derives one distinct origin per app from the single base domain", () =>
  Effect.gen(function* program() {
    assert.deepStrictEqual(deriveOrigins(settings.prefix, "example.com"), settings.origins);
    const config = yield* Effect.provideService(
      deploymentSettings,
      ConfigProvider,
      environment({}),
    );
    assert.deepStrictEqual(config.origins, settings.origins);
    assert.strictEqual(new Set(Object.values(config.origins)).size, 3);
  }),
);

it.effect("refuses a base domain that is not a bare hostname", () =>
  Effect.gen(function* program() {
    const failure = yield* Effect.provideService(
      deploymentSettings,
      ConfigProvider,
      environment({ TEMPLATE_APP_DOMAIN: "https://example.com" }),
    ).pipe(Effect.flip);
    assert.include(yield* encodeJson(describeFailure(failure, [])), "TEMPLATE_APP_DOMAIN");
  }),
);

it.effect("refuses origins that collapse onto one host and names the keys", () =>
  Effect.gen(function* program() {
    const shared = settings.origins["service-member"];
    const config = yield* Schema.decodeEffect(SharedSettings)({
      ...settings,
      origins: { ...settings.origins, "internal-dashboard": shared, "service-admin": shared },
    });
    const failure = yield* checkSharedConfig(config).pipe(Effect.flip);
    assert.strictEqual(failure.code, "origins_must_differ");
    assert.deepStrictEqual([...failure.keys], ["TEMPLATE_APP_DOMAIN", "TEMPLATE_PREFIX"]);
  }),
);

it.effect("refuses a sender address outside the subdomain named by the prefix", () =>
  Effect.forEach(
    ["mail@example.com", "mail@send.example.com", `mail@${settings.prefix}x.example.com`],
    (mailFrom) =>
      Effect.gen(function* program() {
        const config = yield* Schema.decodeEffect(SharedSettings)({ ...settings, mailFrom });
        const failure = yield* checkSharedConfig(config).pipe(Effect.flip);
        assert.strictEqual(failure.code, "mail_from_outside_deployment");
        assert.deepStrictEqual([...failure.keys], ["TEMPLATE_MAIL_FROM", "TEMPLATE_PREFIX"]);
        assert.notInclude(yield* encodeJson(failure), mailFrom);
      }),
  ),
);

it.effect("accepts a sender address on the subdomain named by the prefix", () =>
  Effect.gen(function* program() {
    const config = yield* Schema.decodeEffect(SharedSettings)(settings);
    assert.strictEqual((yield* checkSharedConfig(config)).mailFrom, settings.mailFrom);
  }),
);

it.effect("leaves OTLP unconfigured without an endpoint", () =>
  Effect.gen(function* program() {
    const config = yield* Effect.provideService(
      deploymentSettings,
      ConfigProvider,
      environment({ TEMPLATE_OTLP_ENDPOINT: undefined }),
    );
    assert.isUndefined(config.otlp);
  }),
);

it.effect("sends traces wherever the endpoint points once it is given", () =>
  Effect.gen(function* program() {
    const config = yield* Effect.provideService(
      deploymentSettings,
      ConfigProvider,
      environment({}),
    );
    assert.deepStrictEqual(config.otlp, { endpoint: settings.otlp.endpoint });
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

for (const key of ["sk_live_notARealKey", "rk_live_notARealKey", "pk_test_notARealKey"]) {
  it.effect(`rejects Stripe key ${key.slice(0, 8)} outside the sandbox`, () =>
    Effect.provideService(
      stripeSandboxKey,
      ConfigProvider,
      environment({ [deploymentKey.stripeApiKey]: key }),
    ).pipe(Effect.flip, Effect.asVoid),
  );
}

it("reads the Stripe key from the variable Alchemy's Stripe authentication reads", () => {
  assert.strictEqual(deploymentKey.stripeApiKey, STRIPE_API_KEY_ENV);
});

it.effect("accepts a Stripe sandbox secret key", () =>
  Effect.gen(function* program() {
    const key = yield* Effect.provideService(stripeSandboxKey, ConfigProvider, environment({}));
    assert.strictEqual(Redacted.value(key), verificationSettings.stripeApiKey);
  }),
);
