import {
  Fixture,
  HTTP_FORBIDDEN,
  HTTP_OK,
  PASSWORD,
  TEST_TIMEOUT,
  bootstrapVerifiedAdmin,
  enableTotp,
  failureTag,
  registerVerified,
  signIn,
  signInAs,
  withAuth,
} from "./auth-test-fixture.ts";
import { assert, it } from "@effect/vitest";
import { BrowserClient } from "./browser-client.ts";
import { Effect } from "effect";

const email = "admin@example.com";
const totpUriPattern = /^otpauth:\/\/totp\//u;

function totpUri(body: unknown): string {
  return typeof body === "object" && body !== null ? String(Reflect.get(body, "totpURI")) : "";
}

const assertTotpUriDenied = Effect.fn("assertTotpUriDenied")(function* assertTotpUriDenied(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  client: Readonly<BrowserClient>,
) {
  const denied = yield* client.json("/two-factor/get-totp-uri", { password: PASSWORD });
  assert.strictEqual(denied.status, HTTP_FORBIDDEN);
  assert.deepInclude(denied.body, { message: "ADMIN_MFA_REQUIRED" });
  assert.notProperty(denied.body, "totpURI");
});

const assertTotpUriAllowed = Effect.fn("assertTotpUriAllowed")(function* assertTotpUriAllowed(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  client: Readonly<BrowserClient>,
) {
  const allowed = yield* client.json("/two-factor/get-totp-uri", { password: PASSWORD });
  assert.strictEqual(allowed.status, HTTP_OK);
  assert.match(totpUri(allowed.body), totpUriPattern);
});

const recoverySession = Effect.fn("recoverySession")(function* recoverySession(
  audience: "user" | "admin",
) {
  yield* bootstrapVerifiedAdmin(email);
  const { backupCodes } = yield* enableTotp(yield* signInAs("admin", email));
  const client = new BrowserClient((yield* Fixture)[audience]);
  const login = yield* client.json("/sign-in/email", { email, password: PASSWORD });
  assert.deepInclude(login.body, { twoFactorRedirect: true });
  const code = { code: backupCodes[0] };
  const verified = yield* client.request("/two-factor/verify-backup-code", code);
  assert.strictEqual(verified.status, HTTP_OK);
  return client;
});

it.effect(
  "admin enrollment session cannot access CRM until real TOTP verification",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* bootstrapVerifiedAdmin(email);
        const client = yield* signInAs("admin", email);
        assert.strictEqual(yield* failureTag(client.verify()), "AdminMfaRequired");
        assert.strictEqual((yield* client.verify(true)).strong, false);
        yield* enableTotp(client);
        assert.strictEqual((yield* client.verify()).strong, true);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "TOTP sign-in has no usable session until valid second factor",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const client = yield* registerVerified("totp@example.com");
        yield* signIn(client, "totp@example.com");
        const { authenticator } = yield* enableTotp(client);
        yield* client.request("/sign-out", {});
        const challenge = yield* client.json("/sign-in/email", {
          email: "totp@example.com",
          password: PASSWORD,
        });
        assert.deepInclude(challenge.body, { twoFactorRedirect: true });
        assert.strictEqual(yield* failureTag(client.verify()), "SessionRequired");
        assert.isFalse((yield* client.request("/two-factor/verify-totp", { code: "x" })).ok);
        yield* client.request("/two-factor/verify-totp", { code: authenticator.generate() });
        assert.strictEqual((yield* client.verify()).strong, true);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "old weak admin session cannot enroll another factor after MFA enrollment",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* bootstrapVerifiedAdmin(email);
        const first = yield* signInAs("admin", email);
        const old = yield* signInAs("admin", email);
        yield* enableTotp(first);
        const attempt = yield* old.json("/passkey/generate-register-options");
        assert.strictEqual(attempt.status, HTTP_FORBIDDEN);
        assert.deepInclude(attempt.body, { message: "EXISTING_FACTOR_REQUIRED" });
        assert.isFalse((yield* old.request("/two-factor/verify-totp", { code: "x" })).ok);
        const weak = [(yield* old.verify(true)).strong, yield* failureTag(old.verify())];
        assert.deepStrictEqual(weak, [false, "AdminMfaRequired"]);
      }),
    ),
  TEST_TIMEOUT,
);

for (const audience of ["user", "admin"] as const) {
  it.effect(
    `weak admin session cannot retrieve TOTP secret through ${audience} app`,
    () =>
      withAuth(
        Effect.gen(function* program() {
          yield* bootstrapVerifiedAdmin(email);
          const old = yield* signInAs(audience, email);
          const { authenticator } = yield* enableTotp(yield* signInAs("admin", email));
          yield* assertTotpUriDenied(old);
          assert.strictEqual((yield* old.verify(true)).strong, false);
          const code = { code: authenticator.generate() };
          assert.strictEqual((yield* old.request("/two-factor/verify-totp", code)).status, HTTP_OK);
          assert.strictEqual((yield* old.verify(true)).strong, true);
          yield* assertTotpUriAllowed(old);
        }),
      ),
    TEST_TIMEOUT,
  );

  it.effect(
    `admin recovery session cannot retrieve TOTP secret through ${audience} app`,
    () =>
      withAuth(
        Effect.gen(function* program() {
          const recovery = yield* recoverySession(audience);
          const current = yield* recovery.verify(true);
          assert.deepStrictEqual(
            [current.session.authenticationMethod, current.strong],
            ["recovery", false],
          );
          yield* assertTotpUriDenied(recovery);
        }),
      ),
    TEST_TIMEOUT,
  );
}

it.effect(
  "regular user can still retrieve TOTP URI with their password",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const reader = "reader@example.com";
        const enrollment = yield* registerVerified(reader);
        assert.strictEqual((yield* signIn(enrollment, reader)).status, HTTP_OK);
        const old = yield* signInAs("user", reader);
        yield* enableTotp(enrollment);
        const current = yield* old.verify();
        assert.deepStrictEqual([current.user.role, current.strong], ["user", false]);
        yield* assertTotpUriAllowed(old);
      }),
    ),
  TEST_TIMEOUT,
);
