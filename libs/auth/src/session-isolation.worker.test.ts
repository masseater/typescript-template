import { assert, it } from "@effect/vitest";
import { setUserRole } from "@repo/db/admin";
import { capturePrepares } from "@repo/db/testing";
import { Effect } from "effect";

import {
  Fixture,
  HTTP_FORBIDDEN,
  HTTP_OK,
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
import { BrowserClient } from "./browser-client.ts";

const adminEmail = "admin@example.com";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function adminCopyOf(from: Readonly<BrowserClient>, to: BrowserClient): BrowserClient {
  for (const [key, value] of from.cookies) {
    const adminKey = key.replaceAll("template-service-member", "template-service-admin");
    to.cookies.set(adminKey, value);
  }
  return to;
}

it.effect(
  "wiki auth finishes OAuth provider initialization while its layer is built",
  () =>
    withEmptyDatabase(
      Effect.gen(function* program() {
        const wiki = Effect.scoped(authFor("internal-dashboard"));
        assert.strictEqual(yield* failureTag(wiki), "AuthFailure");
        assert.strictEqual(
          (yield* Effect.scoped(authFor("service-member"))).audience,
          "service-member",
        );
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
        const client = yield* signInAs("service-member", adminEmail);
        const forged = adminCopyOf(client, new BrowserClient((yield* Fixture)["service-admin"]));
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
        const client = yield* signInAs("service-member", adminEmail);
        const { authenticator } = yield* enableTotp(client);
        yield* client.request("/sign-out", {});
        yield* signIn(client, adminEmail);
        const transferred = adminCopyOf(
          client,
          new BrowserClient((yield* Fixture)["service-admin"]),
        );
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
        const adminClient = yield* signInAs("service-admin", "owner@example.com");
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

it.effect(
  "verifySession reads session and user with one D1 prepare",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const client = yield* registerVerified("session-once@example.com");
        assert.strictEqual((yield* signIn(client, "session-once@example.com")).status, HTTP_OK);
        const statements = yield* capturePrepares(client.verify().pipe(Effect.asVoid));
        const sessionReads = statements.filter((sql) => /\bsession\b/i.test(sql));
        assert.strictEqual(sessionReads.length, 1);
        assert.match(sessionReads[0] ?? "", /\buser\b/i);
      }),
    ),
  TEST_TIMEOUT,
);
