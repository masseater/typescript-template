import { readConfig } from "@repo/config";
import { env } from "cloudflare:workers";
import { Effect, Redacted } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { appEnvironment, fixtureAuthSecret, fixtureOrigin } from "./app-test-fixture.ts";
import { readWorkerConfig } from "./bindings.ts";

describe("readWorkerConfig", () => {
  describe("a complete worker environment", () => {
    const it = test
      .extend("workerEnvironment", () => appEnvironment())
      .extend("workerConfig", ({ workerEnvironment }) =>
        Effect.runPromise(
          readWorkerConfig(workerEnvironment).pipe(
            Effect.map((config) => ({
              ...config,
              AUTH_SECRET: Redacted.value(config.AUTH_SECRET),
            })),
          ),
        ),
      );

    it("reads D1, the auth secret, and email", ({ workerConfig, workerEnvironment }) => {
      expect(workerConfig).toStrictEqual({
        AI: undefined,
        APP_ORIGIN: fixtureOrigin,
        APP_RELEASE: "test",
        ASSETS: workerEnvironment["ASSETS"],
        AUTH_SECRET: fixtureAuthSecret,
        DB: env.DB,
        EMAIL: workerEnvironment["EMAIL"],
        EMAIL_FROM: "sender@example.test",
        OPS_EMAIL: "ops@example.test",
        local: true,
      });
    });
  });

  describe("an AI layer added beside D1", () => {
    const it = test
      .extend("workerEnvironment", () =>
        appEnvironment({
          AI: {
            gateway: (): object => ({}),
            models: (): Promise<readonly []> => Promise.resolve([]),
            run: (): Promise<object> => Promise.resolve({}),
          },
        }))
      .extend("workerConfig", ({ workerEnvironment }) =>
        Effect.runPromise(
          readWorkerConfig(workerEnvironment).pipe(
            Effect.map((config) => ({
              ...config,
              AUTH_SECRET: Redacted.value(config.AUTH_SECRET),
            })),
          ),
        ),
      );

    it("keeps the real D1 binding and the model", ({ workerConfig, workerEnvironment }) => {
      expect(workerConfig).toStrictEqual({
        AI: workerEnvironment["AI"],
        APP_ORIGIN: fixtureOrigin,
        APP_RELEASE: "test",
        ASSETS: workerEnvironment["ASSETS"],
        AUTH_SECRET: fixtureAuthSecret,
        DB: env.DB,
        EMAIL: workerEnvironment["EMAIL"],
        EMAIL_FROM: "sender@example.test",
        OPS_EMAIL: "ops@example.test",
        local: true,
      });
    });
  });

  describe.for([
    ["without a database", ["DB"], {}],
    ["without a mail binding or Mailpit", ["EMAIL", "MAILPIT_URL"], {}],
    ["whose FLAGS binding is not Flagship", [], { FLAGS: {} }],
  ] as const)("an environment %s", ([, absent, overrides]) => {
    const it = test
      .extend("workerEnvironment", () =>
        Object.fromEntries(
          Object.entries(appEnvironment(overrides)).filter(
            ([binding]) => !absent.some((absentBinding) => absentBinding === binding),
          ),
        ))
      .extend("workerRefusal", ({ workerEnvironment }) =>
        Effect.runPromise(Effect.flip(readWorkerConfig(workerEnvironment))),
      )
      .extend("configRefusal", ({ workerEnvironment }) =>
        Effect.runPromise(Effect.flip(readConfig(workerEnvironment))),
      );

    it("is refused exactly as the config boundary refuses it", ({
      workerRefusal,
      configRefusal,
    }) => {
      expect(workerRefusal).toStrictEqual(configRefusal);
    });
  });
});
