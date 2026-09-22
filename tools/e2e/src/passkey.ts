import { Effect } from "effect";

import { failed } from "./journey-failure.ts";

import type { Page } from "playwright";

const authenticatorOptions = {
  automaticPresenceSimulation: true,
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  protocol: "ctap2",
  transport: "internal",
} as const;

const enableVirtualAuthenticator = (page: Page): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* armVirtualAuthenticator() {
      const client = yield* Effect.tryPromise({
        catch: (cause) => failed("E2E_PASSKEY_UNAVAILABLE", cause),
        try: () => page.context().newCDPSession(page),
      });
      yield* Effect.tryPromise({
        catch: (cause) => failed("E2E_PASSKEY_UNAVAILABLE", cause),
        try: () => client.send("WebAuthn.enable", { enableUI: false }),
      });
      const { authenticatorId } = yield* Effect.tryPromise({
        catch: (cause) => failed("E2E_PASSKEY_UNAVAILABLE", cause),
        try: () =>
          client.send("WebAuthn.addVirtualAuthenticator", { options: authenticatorOptions }),
      });
      yield* Effect.tryPromise({
        catch: (cause) => failed("E2E_PASSKEY_UNAVAILABLE", cause),
        try: () =>
          client.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: true }),
      });
      yield* Effect.tryPromise({
        catch: (cause) => failed("E2E_PASSKEY_UNAVAILABLE", cause),
        try: () =>
          client.send("WebAuthn.setAutomaticPresenceSimulation", {
            authenticatorId,
            enabled: true,
          }),
      });
    }).pipe(Effect.orDie),
  );

export { enableVirtualAuthenticator };
