import {
  Fixture,
  HTTP_OK,
  TEST_TIMEOUT,
  registerVerified,
  signIn,
  withAuth,
} from "./auth-test-fixture.ts";
import { assert, it } from "@effect/vitest";
import { BrowserClient } from "./browser-client.ts";
import { Effect } from "effect";

const clientIpHeader = "cf-connecting-ip";
const HTTP_TOO_MANY_REQUESTS = 429;
const signInBurst = 4;
const email = "burst@example.com";
const addresses = { first: "203.0.113.10", second: "203.0.113.20" };

const signInFrom = Effect.fn("signInFrom")(function* signInFrom(
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
        yield* registerVerified(email);
        const burst: number[] = [];
        for (let attempt = 0; attempt < signInBurst; attempt += 1) {
          burst.push(yield* signInFrom({ [clientIpHeader]: addresses.first }));
        }
        assert.deepStrictEqual(burst, [HTTP_OK, HTTP_OK, HTTP_OK, HTTP_TOO_MANY_REQUESTS]);
        assert.strictEqual(yield* signInFrom({ [clientIpHeader]: addresses.second }), HTTP_OK);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "a forwarded-for header does not hand a client a second sign-in window",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* registerVerified(email);
        for (let attempt = 0; attempt < signInBurst; attempt += 1) {
          yield* signInFrom({ [clientIpHeader]: addresses.first });
        }
        const forwarded = yield* signInFrom({
          [clientIpHeader]: addresses.first,
          "x-forwarded-for": addresses.second,
        });
        assert.strictEqual(forwarded, HTTP_TOO_MANY_REQUESTS);
      }),
    ),
  TEST_TIMEOUT,
);
