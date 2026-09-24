import { applicationOrigins } from "@repo/config";
import { Effect, FileSystem, Path, PlatformError } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { layer } from "./platform.ts";
import { replacePrivateFile } from "./private-files.ts";
import { appVariables, sharedRunnerCredentials } from "./shared-runner-credentials.ts";

function privateFile(
  name: string,
): Effect.Effect<URL, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* privateFileProgram() {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const base = yield* fs.makeTempDirectory({ prefix: "private-files-" });
    return new URL(`file://${path.join(base, name)}`);
  });
}

describe("replacing a private file", () => {
  it("leaves a file that already holds the content alone", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const location = yield* privateFile("kept");
        yield* replacePrivateFile(location, "same\n");
        const written = yield* Effect.gen(function* statWritten() {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const resolved = yield* path.fromFileUrl(location);
          return yield* fs.stat(resolved);
        });
        yield* replacePrivateFile(location, "same\n");
        const revisited = yield* Effect.gen(function* statRevisited() {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const resolved = yield* path.fromFileUrl(location);
          return yield* fs.stat(resolved);
        });
        expect(revisited.mtime).toStrictEqual(written.mtime);
        const content = yield* Effect.gen(function* readContent() {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const resolved = yield* path.fromFileUrl(location);
          return yield* fs.readFileString(resolved);
        });
        expect(content).toBe("same\n");
      }).pipe(Effect.provide(layer)),
    ));

  it("rewrites a file that holds different content", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const location = yield* privateFile("replaced");
        yield* replacePrivateFile(location, "before\n");
        yield* replacePrivateFile(location, "after\n");
        const content = yield* Effect.gen(function* readContent() {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const resolved = yield* path.fromFileUrl(location);
          return yield* fs.readFileString(resolved);
        });
        expect(content).toBe("after\n");
      }).pipe(Effect.provide(layer)),
    ));
});

describe("the variables every runner shares", () => {
  it("derives one secret and keeps the origins off the network", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const credentials = yield* sharedRunnerCredentials();
        expect(credentials).toStrictEqual(yield* sharedRunnerCredentials());
        expect(appVariables("service-member", credentials, "loopback")).toMatchObject({
          APP_ORIGIN: applicationOrigins["service-member"],
          AUTH_SECRET: credentials.authSecret,
        });
      }).pipe(Effect.provide(layer)),
    ));

  it("gives the member app test-mode Stripe placeholders until real test keys are stored", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const credentials = yield* sharedRunnerCredentials();
        expect(appVariables("service-member", credentials, "loopback")).toMatchObject({
          STRIPE_PRICE_ID: expect.stringMatching(/^price_[A-Za-z0-9]+$/u),
          STRIPE_SECRET_KEY: expect.stringMatching(/^sk_test_[A-Za-z0-9]+$/u),
          STRIPE_WEBHOOK_SECRET: expect.stringMatching(/^whsec_[A-Za-z0-9]+$/u),
        });
        const stripe = {
          priceId: "price_storedNotReal",
          secretKey: "sk_test_storedNotAReal",
          webhookSecret: "whsec_storedNotReal",
        };
        expect(
          appVariables("service-member", { ...credentials, stripe }, "loopback"),
        ).toMatchObject({
          STRIPE_PRICE_ID: stripe.priceId,
          STRIPE_SECRET_KEY: stripe.secretKey,
          STRIPE_WEBHOOK_SECRET: stripe.webhookSecret,
        });
        expect(Object.keys(appVariables("service-admin", credentials, "loopback"))).not.toContain(
          "STRIPE_SECRET_KEY",
        );
      }).pipe(Effect.provide(layer)),
    ));
});
