import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  Fixture,
  HTTP_OK,
  TEST_TIMEOUT,
  registerVerified,
  signIn,
  withAuth,
} from "./auth-test-fixture.ts";
import { BrowserClient } from "./browser-client.ts";

const HTTP_TOO_MANY_REQUESTS = 429;

const signInFrom = Effect.fn("signInFrom")(function* signInFrom(
  email: string,
  network: Readonly<Record<string, string>>,
) {
  const client = new BrowserClient((yield* Fixture).user, network);
  return (yield* signIn(client, email)).status;
});

it.effect(
  "an exhausted sign-in window belongs to the address that spent it",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const email = "spender@example.com";
        const spender = { "cf-connecting-ip": "203.0.113.10" };
        const bystander = { "cf-connecting-ip": "203.0.113.11" };
        const burstLength = 4;
        yield* registerVerified(email);
        const burst: number[] = [];
        for (let attempt = 0; attempt < burstLength; attempt += 1) {
          burst.push(yield* signInFrom(email, spender));
        }
        assert.deepStrictEqual(burst, [HTTP_OK, HTTP_OK, HTTP_OK, HTTP_TOO_MANY_REQUESTS]);
        assert.strictEqual(yield* signInFrom(email, bystander), HTTP_OK);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "a forwarded-for header does not hand a client a second sign-in window",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const email = "forwarder@example.com";
        const forwarder = { "cf-connecting-ip": "203.0.113.20" };
        const burstLength = 4;
        yield* registerVerified(email);
        for (let attempt = 0; attempt < burstLength; attempt += 1) {
          yield* signInFrom(email, forwarder);
        }
        const forwarded = yield* signInFrom(email, {
          ...forwarder,
          "x-forwarded-for": "203.0.113.21",
        });
        assert.strictEqual(forwarded, HTTP_TOO_MANY_REQUESTS);
      }),
    ),
  TEST_TIMEOUT,
);
