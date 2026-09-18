import { assert } from "@effect/vitest";
import { sendVerificationEmail } from "@template/config";
import { EmptyTestDatabase, TestDatabase, bootstrapAdmin } from "@template/db/testing";
import { Context, Effect, Layer, Schema } from "effect";
import { URI } from "otpauth";

import { Auth } from "./auth.ts";
import { BrowserClient, origins } from "./browser-client.ts";
import { mailConfig, mailServer, mailbox } from "./mail-fixture.ts";

import type { Application } from "@template/config";
import type { Database } from "@template/db";
import type { Scope } from "effect";
import type { AuthFailure } from "./auth-failure.ts";

type AuthService = Auth["Service"];
type TestServices = Layer.Success<typeof TestDatabase>;

const PASSWORD = "test-password-safe-123";
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_FOUND = 302;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const TEST_TIMEOUT = { timeout: 60_000 };
const secret = "integration-test-secret-at-least-32-characters-long";
const TotpEnrollment = Schema.Struct({
  backupCodes: Schema.Array(Schema.String),
  totpURI: Schema.String,
});

const decodeOrDie = <Contract extends Schema.Top & { readonly DecodingServices: never }>(
  contract: Contract,
  input: unknown,
): Effect.Effect<Contract["Type"]> => {
  return Schema.decodeUnknownEffect(contract)(input).pipe(Effect.orDie);
};

const authFor = (
  audience: Application,
): Effect.Effect<AuthService, AuthFailure, Database | Scope.Scope> => {
  const layer = Auth.layer({
    audience,
    baseURL: origins[audience],
    secret,
    sendVerificationEmail: (message) =>
      sendVerificationEmail({ ...mailConfig, APP_ORIGIN: origins[audience] }, message),
  });

  return Layer.build(layer).pipe(Effect.map((context) => Context.get(context, Auth)));
};

class Fixture extends Context.Service<
  Fixture,
  { readonly user: AuthService; readonly admin: AuthService; readonly wiki: AuthService }
>()("AuthTestFixture") {}

const fixture = Layer.effect(
  Fixture,
  Effect.gen(function* buildFixture() {
    return Fixture.of({
      admin: yield* authFor("admin"),
      user: yield* authFor("user"),
      wiki: yield* authFor("wiki"),
    });
  }),
).pipe(Layer.provideMerge(TestDatabase), Layer.provideMerge(mailServer));

const withAuth = <Value>(
  effect: Effect.Effect<Value, unknown, Fixture | TestServices>,
): Effect.Effect<Value, unknown> => {
  return effect.pipe(Effect.provide(fixture));
};

const withEmptyDatabase = <Value>(
  effect: Effect.Effect<Value, unknown, TestServices>,
): Effect.Effect<Value, unknown> => {
  return effect.pipe(Effect.provide(EmptyTestDatabase));
};

const verifyEmail = Effect.fn("verifyEmail")(function* verifyEmail(email: string) {
  const { user } = yield* Fixture;
  const link = new URL(mailbox.get(email) ?? "http://invalid.test/");
  assert.deepStrictEqual([link.pathname, link.search], ["/verify-email", ""]);
  const token = new URLSearchParams(link.hash.slice(1)).get("token") ?? "";
  yield* Effect.promise(async () => user.instance.api.verifyEmail({ query: { token } }));
});

const register = Effect.fn("register")(function* register(email: string) {
  const { user } = yield* Fixture;
  const client = new BrowserClient(user);
  const signUp = { email, name: email, password: PASSWORD };
  assert.isTrue((yield* client.request("/sign-up/email", signUp)).ok);
  return client;
});

const registerVerified = Effect.fn("registerVerified")(function* registerVerified(email: string) {
  const client = yield* register(email);
  yield* verifyEmail(email);
  return client;
});

const bootstrapVerifiedAdmin = Effect.fn("bootstrapVerifiedAdmin")(function* bootstrapVerifiedAdmin(
  email: string,
) {
  yield* registerVerified(email);
  yield* bootstrapAdmin(email);
});

const signIn = (client: Readonly<BrowserClient>, email: string): Effect.Effect<Response> => {
  return client.request("/sign-in/email", { email, password: PASSWORD });
};

const signInAs = Effect.fn("signInAs")(function* signInAs(audience: Application, email: string) {
  const client = new BrowserClient((yield* Fixture)[audience]);
  assert.strictEqual((yield* signIn(client, email)).status, HTTP_OK);
  return client;
});

const enableTotp = Effect.fn("enableTotp")(function* enableTotp(client: Readonly<BrowserClient>) {
  const response = yield* client.json("/two-factor/enable", { password: PASSWORD });
  assert.strictEqual(response.status, HTTP_OK);
  const enrollment = yield* decodeOrDie(TotpEnrollment, response.body);
  const authenticator = URI.parse(enrollment.totpURI);
  const code = { code: authenticator.generate() };
  assert.strictEqual((yield* client.request("/two-factor/verify-totp", code)).status, HTTP_OK);
  return { authenticator, backupCodes: enrollment.backupCodes };
});

const failureTag = <Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> => {
  return effect.pipe(
    Effect.flip,
    Effect.map((error) => error._tag),
  );
};

export {
  Fixture,
  HTTP_CREATED,
  HTTP_FORBIDDEN,
  HTTP_FOUND,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  PASSWORD,
  TEST_TIMEOUT,
  authFor,
  bootstrapVerifiedAdmin,
  decodeOrDie,
  enableTotp,
  failureTag,
  register,
  registerVerified,
  signIn,
  signInAs,
  withAuth,
  withEmptyDatabase,
};
