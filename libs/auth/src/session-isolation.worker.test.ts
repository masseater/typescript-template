import {
  Fixture,
  HTTP_FORBIDDEN,
  TEST_TIMEOUT,
  authFor,
  bootstrapVerifiedAdmin,
  enableTotp,
  failureTag,
  registerVerified,
  signIn,
  signInAs,
  withAuth,
  withEmptyDatabase,
} from "./auth-test-fixture.ts";
import { assert, it } from "@effect/vitest";
import { BrowserClient } from "./browser-client.ts";
import { Effect } from "effect";
import { setUserRole } from "@repo/db/admin";

const adminEmail = "admin@example.com";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function adminCopyOf(from: Readonly<BrowserClient>, to: BrowserClient): BrowserClient {
  for (const [key, value] of from.cookies) {
    const adminKey = key.replaceAll("template-user", "template-admin");
    to.cookies.set(adminKey, value);
  }
  return to;
}

it.effect(
  "wiki auth finishes OAuth provider initialization while its layer is built",
  () =>
    withEmptyDatabase(
      Effect.gen(function* program() {
        const wiki = Effect.scoped(authFor("wiki"));
        assert.strictEqual(yield* failureTag(wiki), "AuthFailure");
        assert.strictEqual((yield* Effect.scoped(authFor("user"))).audience, "user");
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "shared signing secret cannot turn a user session into admin session",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* bootstrapVerifiedAdmin(adminEmail);
        const client = yield* signInAs("user", adminEmail);
        const forged = adminCopyOf(client, new BrowserClient((yield* Fixture).admin));
        assert.strictEqual(yield* failureTag(forged.verify(true)), "SessionInvalid");
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "shared signing secret cannot transfer a pending TOTP challenge across apps",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* bootstrapVerifiedAdmin(adminEmail);
        const client = yield* signInAs("user", adminEmail);
        const { authenticator } = yield* enableTotp(client);
        yield* client.request("/sign-out", {});
        yield* signIn(client, adminEmail);
        const transferred = adminCopyOf(client, new BrowserClient((yield* Fixture).admin));
        const response = yield* transferred.json("/two-factor/verify-totp", {
          code: authenticator.generate(),
        });
        assert.strictEqual(response.status, HTTP_FORBIDDEN);
        assert.deepInclude(response.body, { message: "CHALLENGE_AUDIENCE_INVALID" });
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "revocation invalidates an actual HTTP session",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* bootstrapVerifiedAdmin("owner@example.com");
        const adminClient = yield* signInAs("admin", "owner@example.com");
        yield* enableTotp(adminClient);
        const authority = yield* adminClient.verify();
        const target = yield* registerVerified("target@example.com");
        yield* signIn(target, "target@example.com");
        const current = yield* target.verify();
        yield* setUserRole(authority.session.id, current.user.id, "admin");
        assert.strictEqual(yield* failureTag(target.verify()), "SessionRequired");
      }),
    ),
  TEST_TIMEOUT,
);
