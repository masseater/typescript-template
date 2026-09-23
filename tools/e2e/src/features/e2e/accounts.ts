import { Crypto, Effect } from "effect";

import { failed } from "./journey-failure.ts";

type Account = {
  readonly email: string;
  readonly name: string;
  readonly password: string;
};

const shortIdentifierLength = 8;

const newAccount = (role: string): Effect.Effect<Account, never, Crypto.Crypto> =>
  Effect.gen(function* createAccount() {
    const crypto = yield* Crypto.Crypto;
    const identifier = yield* crypto.randomUUIDv4.pipe(
      Effect.mapError((cause) => failed("E2E_ACCOUNT_IDENTIFIER_UNAVAILABLE", cause)),
      Effect.orDie,
    );
    return {
      email: `${role}-${identifier}@example.test`,
      name: `${role} ${identifier.slice(0, shortIdentifierLength)}`,
      password: `journey-${identifier}`,
    };
  });

export { newAccount };
export type { Account };
