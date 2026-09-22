import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { ConfigurationInvalid } from "./configuration-invalid.ts";
import { isLocalDevelopmentOrigin, readEnvironment, readStripeConfig } from "./index.ts";

const localBindings = {
  APP_ORIGIN: "http://localhost:3001",
  AUTH_SECRET: "test-environment-secret-not-for-any-deployment",
  EMAIL_FROM: "sender@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
  OPS_EMAIL: "ops@example.test",
};

describe("readEnvironment", () => {
  describe("local bindings without a release", () => {
    const it = test.extend("localEnvironment", () =>
      Effect.runPromise(readEnvironment(localBindings)));

    it("marks the environment local, names the release local and derives the Mailpit endpoint", ({
      localEnvironment,
    }) => {
      expect(localEnvironment).toStrictEqual({
        ...localBindings,
        APP_RELEASE: "local",
        MAILPIT_SEND_URL: "http://127.0.0.1:8025/api/v1/send",
        local: true,
      });
    });
  });

  describe("an HTTPS origin on a LAN host", () => {
    const it = test.extend("lanEnvironment", () =>
      Effect.runPromise(
        readEnvironment({
          ...localBindings,
          APP_ORIGIN: "https://template-user.local.example.test",
        }),
      ));

    it("is local development", ({ lanEnvironment }) => {
      expect(lanEnvironment).toStrictEqual({
        ...localBindings,
        APP_ORIGIN: "https://template-user.local.example.test",
        APP_RELEASE: "local",
        MAILPIT_SEND_URL: "http://127.0.0.1:8025/api/v1/send",
        local: true,
      });
    });
  });

  describe("a public HTTPS origin without Mailpit", () => {
    const it = test.extend("publicEnvironment", () => {
      const { MAILPIT_URL: _mailpit, ...remoteBindings } = localBindings;
      return Effect.runPromise(
        readEnvironment({ ...remoteBindings, APP_ORIGIN: "https://app.example.test" }),
      );
    });

    it("is not local development and sends no mail through Mailpit", ({ publicEnvironment }) => {
      expect(publicEnvironment).toStrictEqual({
        APP_ORIGIN: "https://app.example.test",
        APP_RELEASE: "local",
        AUTH_SECRET: localBindings.AUTH_SECRET,
        EMAIL_FROM: localBindings.EMAIL_FROM,
        OPS_EMAIL: localBindings.OPS_EMAIL,
        local: false,
      });
    });
  });

  describe.for([
    [
      "a plain HTTP LAN origin",
      { APP_ORIGIN: "http://template-user.local.example.test" },
      "HTTPS is required outside localhost",
    ],
    [
      "a plain HTTP public origin",
      { APP_ORIGIN: "http://app.example.test" },
      "HTTPS is required outside localhost",
    ],
    [
      "Mailpit behind a public origin",
      { APP_ORIGIN: "https://app.example.test" },
      "Mailpit is restricted to local development",
    ],
    [
      "Mailpit and an OTLP switch that are both invalid",
      { APP_ORIGIN: "https://app.example.test", OTLP_ENABLED: "true" },
      "Mailpit is restricted to local development",
    ],
    [
      "an OTLP switch turned on without an endpoint",
      { OTLP_ENABLED: "true" },
      "OTLP_ENABLED needs OTLP_ENDPOINT",
    ],
    [
      "an OTLP switch turned off without an endpoint",
      { OTLP_ENABLED: "false" },
      "OTLP_ENABLED needs OTLP_ENDPOINT",
    ],
    [
      "a release carrying an email address",
      { APP_RELEASE: "private@example.com" },
      'Expected a string matching the RegExp ^[a-zA-Z0-9._-]{1,64}$\n  at ["APP_RELEASE"]',
    ],
    [
      "a session secret shorter than 32 characters",
      { AUTH_SECRET: "weak" },
      'Expected a value with a length of at least 32\n  at ["AUTH_SECRET"]',
    ],
    [
      "an origin carrying a path",
      { APP_ORIGIN: "http://localhost:3001/path" },
      'An origin without a path is required\n  at ["APP_ORIGIN"]',
    ],
    [
      "an origin that is not a URL",
      { APP_ORIGIN: "not-a-url" },
      'Expected an absolute URL\n  at ["APP_ORIGIN"]',
    ],
  ] as const)("%s", ([, overridden, expectedReason]) => {
    const it = test.extend("refusal", () =>
      Effect.runPromise(Effect.flip(readEnvironment({ ...localBindings, ...overridden }))));

    it("is refused with the reason that names the rule it breaks", ({ refusal }) => {
      expect(refusal).toStrictEqual(new ConfigurationInvalid({ reason: expectedReason }));
    });
  });
});

describe("an OTLP switch beside an endpoint", () => {
  const it = test.extend("otlpEnvironment", () =>
    Effect.runPromise(
      readEnvironment({
        ...localBindings,
        OTLP_ENABLED: "true",
        OTLP_ENDPOINT: localBindings.MAILPIT_URL,
      }),
    ));

  it("is read as it was written", ({ otlpEnvironment }) => {
    expect(otlpEnvironment).toStrictEqual({
      ...localBindings,
      APP_RELEASE: "local",
      MAILPIT_SEND_URL: "http://127.0.0.1:8025/api/v1/send",
      OTLP_ENABLED: "true",
      OTLP_ENDPOINT: localBindings.MAILPIT_URL,
      local: true,
    });
  });
});

const stripeBindings = {
  APP_ORIGIN: "http://localhost:3001",
  STRIPE_PRICE_ID: "price_placeholderNotReal",
  STRIPE_SECRET_KEY: "sk_test_placeholderNotAReal",
  STRIPE_WEBHOOK_SECRET: "whsec_placeholderNotReal",
};

describe("readStripeConfig", () => {
  describe("test-mode keys on a local origin", () => {
    const it = test.extend("stripeConfig", async () =>
      Effect.runPromise(readStripeConfig(stripeBindings)));

    it("is read as a test-mode configuration", ({ stripeConfig }) => {
      expect(stripeConfig).toStrictEqual({
        mode: "test",
        priceId: "price_placeholderNotReal",
        secretKey: "sk_test_placeholderNotAReal",
        webhookSecret: "whsec_placeholderNotReal",
      });
    });
  });

  describe("a live key on a deployed origin", () => {
    const it = test.extend("stripeConfig", async () =>
      Effect.runPromise(
        readStripeConfig({
          ...stripeBindings,
          APP_ORIGIN: "https://member.example.test",
          STRIPE_SECRET_KEY: "rk_live_placeholderNotAReal",
        }),
      ));

    it("is read as a live-mode configuration", ({ stripeConfig }) => {
      expect(stripeConfig.mode).toBe("live");
    });
  });

  describe.for([
    [
      "a live key on a local origin",
      { STRIPE_SECRET_KEY: "sk_live_placeholderNotAReal" },
      "Stripe live keys are restricted to deployed origins",
    ],
    [
      "a secret key without a mode",
      { STRIPE_SECRET_KEY: "sk_placeholderNotAReal" },
      'Expected a string matching the RegExp ^(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+$\n  at ["STRIPE_SECRET_KEY"]',
    ],
    [
      "a webhook secret without the whsec prefix",
      { STRIPE_WEBHOOK_SECRET: "placeholderNotReal" },
      'Expected a string matching the RegExp ^whsec_[A-Za-z0-9]+$\n  at ["STRIPE_WEBHOOK_SECRET"]',
    ],
    [
      "a price id without the price prefix",
      { STRIPE_PRICE_ID: "prod_placeholderNotReal" },
      'Expected a string matching the RegExp ^price_[A-Za-z0-9]+$\n  at ["STRIPE_PRICE_ID"]',
    ],
  ] as const)("%s", ([, overridden, expectedReason]) => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(Effect.flip(readStripeConfig({ ...stripeBindings, ...overridden }))));

    it("is refused with the reason that names the rule it breaks", ({ refusal }) => {
      expect(refusal).toStrictEqual(new ConfigurationInvalid({ reason: expectedReason }));
    });
  });

  describe("bindings that carry no Stripe keys at all", () => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(Effect.flip(readStripeConfig({ APP_ORIGIN: stripeBindings.APP_ORIGIN }))));

    it("are refused instead of falling back to a free-for-all", ({ refusal }) => {
      expect(refusal).toStrictEqual(
        new ConfigurationInvalid({ reason: 'Missing key\n  at ["STRIPE_PRICE_ID"]' }),
      );
    });
  });
});

describe("isLocalDevelopmentOrigin", () => {
  describe.for([
    ["https://example.localhost"],
    ["https://user.template.local.example.test"],
    ["https://host.tunnel.example.test"],
    ["https://app.example.test"],
  ] as const)("%s", ([origin]) => {
    const it = test.extend("localDevelopment", () => isLocalDevelopmentOrigin(origin));

    it("is not local development", ({ localDevelopment }) => {
      expect(localDevelopment).toBe(false);
    });
  });
});
