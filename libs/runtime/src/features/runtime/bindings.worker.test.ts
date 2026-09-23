import { ConfigurationInvalid } from "@repo/config";
import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { appEnvironment, fixtureAuthSecret, fixtureOrigin } from "./app-fixture.ts";
import { readWorkerConfig } from "./bindings.ts";

describe("readWorkerConfig", () => {
  describe("the effect-cf bindings layer", () => {
    const it = test
      .extend("workerEnvironment", () => appEnvironment())
      .extend("workerConfig", ({ workerEnvironment }) =>
        Effect.runPromise(readWorkerConfig(workerEnvironment)),
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
        Effect.runPromise(readWorkerConfig(workerEnvironment)),
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

  describe("an environment without a database", () => {
    const it = test.extend("configurationRefusal", () =>
      Effect.runPromise(Effect.flip(readWorkerConfig(appEnvironment({ DB: undefined })))));

    it("names the missing database", ({ configurationRefusal }) => {
      expect(configurationRefusal).toStrictEqual(
        new ConfigurationInvalid({
          reason: 'Cloudflare binding "DB" was not found in WorkerEnvironment',
        }),
      );
    });
  });

  describe("an environment without a mail binding", () => {
    const it = test.extend("configurationRefusal", () =>
      Effect.runPromise(Effect.flip(readWorkerConfig(appEnvironment({ EMAIL: undefined })))));

    it("names the missing mail binding", ({ configurationRefusal }) => {
      expect(configurationRefusal).toStrictEqual(
        new ConfigurationInvalid({ reason: "An email delivery binding is required" }),
      );
    });
  });
});
