import { assert, it } from "@effect/vitest";
import { sendVerificationEmail } from "@template/config";
import type { Audience, Database } from "@template/db";
import { bootstrapAdmin, setUserRole } from "@template/db/admin";
import { TestDatabase, getSchemaShape } from "@template/db/testing";
import { getSchema } from "better-auth/db";
import { Context, Effect, Layer, Schema } from "effect";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { URI } from "otpauth";
import { Auth, verifySession } from "./index.ts";

const password = "test-password-safe-123";
const secret = "integration-test-secret-at-least-32-characters-long";
const mailConfig = {
  EMAIL_FROM: "no-reply@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
};
const origins = { user: "http://localhost:4101", admin: "http://localhost:4102" } as const;

const MailpitMessage = Schema.Struct({
  From: Schema.Struct({ Email: Schema.String }),
  To: Schema.Array(Schema.Struct({ Email: Schema.String })),
  Subject: Schema.String,
  Text: Schema.String,
});

const TotpEnrollment = Schema.Struct({
  totpURI: Schema.String,
  backupCodes: Schema.Array(Schema.String),
});

type AuthService = Auth["Service"];

class BrowserClient {
  readonly cookies = new Map<string, string>();
  readonly auth: AuthService;

  constructor(auth: AuthService) {
    this.auth = auth;
  }

  get origin() {
    return origins[this.auth.audience];
  }

  headers() {
    return new Headers({
      origin: this.origin,
      cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "),
    });
  }

  request(endpoint: string, body?: Record<string, unknown>) {
    return Effect.promise(async () => {
      const headers = this.headers();
      headers.set("content-type", "application/json");
      const response = await this.auth.instance.handler(
        new Request(`${this.origin}/api/auth${endpoint}`, {
          method: body ? "POST" : "GET",
          headers,
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0];
        if (!pair) continue;
        const separator = pair.indexOf("=");
        const key = pair.slice(0, separator);
        const value = pair.slice(separator + 1);
        if (value) this.cookies.set(key, value);
        else this.cookies.delete(key);
      }
      return response;
    });
  }

  json(endpoint: string, body?: Record<string, unknown>) {
    return this.request(endpoint, body).pipe(
      Effect.flatMap((response) =>
        Effect.promise(async () => ({ status: response.status, body: await response.json() })),
      ),
    );
  }

  verify(allowEnrollment = false) {
    return verifySession(this.headers(), allowEnrollment).pipe(
      Effect.provideService(Auth, this.auth),
    );
  }
}

const mailbox = new Map<string, string>();

const mailServer = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.sync(() => {
      mailbox.clear();
      const server = setupServer(
        http.post(`${mailConfig.MAILPIT_URL}/api/v1/send`, async ({ request }) => {
          const message = Schema.decodeUnknownSync(MailpitMessage)(await request.json());
          if (
            message.From.Email !== mailConfig.EMAIL_FROM ||
            message.Subject !== "メールアドレスの確認"
          )
            return HttpResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
          const url = message.Text.split("\n").find((line) => line.startsWith("http://"));
          if (!url)
            return HttpResponse.json({ error: "VERIFICATION_URL_REQUIRED" }, { status: 400 });
          for (const recipient of message.To) mailbox.set(recipient.Email, url);
          return HttpResponse.json({ ID: crypto.randomUUID() });
        }),
      );
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    (server) => Effect.sync(() => server.close()),
  ),
);

const authFor = (audience: Audience) =>
  Layer.build(
    Auth.layer({
      secret,
      baseURL: origins[audience],
      audience,
      sendVerificationEmail: (message) =>
        sendVerificationEmail({ ...mailConfig, APP_ORIGIN: origins[audience] }, message),
    }),
  ).pipe(Effect.map((context) => Context.get(context, Auth)));

class Fixture extends Context.Service<
  Fixture,
  { readonly user: AuthService; readonly admin: AuthService }
>()("Fixture") {}

const fixture = Layer.effect(
  Fixture,
  Effect.gen(function* () {
    return Fixture.of({ user: yield* authFor("user"), admin: yield* authFor("admin") });
  }),
).pipe(Layer.provideMerge(TestDatabase), Layer.provideMerge(mailServer));

const register = Effect.fn(function* (email: string) {
  const { user } = yield* Fixture;
  const client = new BrowserClient(user);
  const response = yield* client.request("/sign-up/email", { name: email, email, password });
  assert.isTrue(response.ok);
  return client;
});

const verifyEmail = Effect.fn(function* (email: string) {
  const { user } = yield* Fixture;
  const url = mailbox.get(email);
  assert.isDefined(url);
  const link = new URL(url ?? "");
  assert.strictEqual(link.pathname, "/verify-email");
  assert.strictEqual(link.search, "");
  const token = new URLSearchParams(link.hash.slice(1)).get("token");
  assert.isString(token);
  yield* Effect.promise(() => user.instance.api.verifyEmail({ query: { token: token ?? "" } }));
});

const registerVerified = Effect.fn(function* (email: string) {
  const client = yield* register(email);
  yield* verifyEmail(email);
  return client;
});

const bootstrapVerifiedAdmin = Effect.fn(function* (email: string) {
  yield* registerVerified(email);
  yield* bootstrapAdmin(email);
});

const signIn = (client: BrowserClient, email: string) =>
  client.request("/sign-in/email", { email, password });

const enableTotp = Effect.fn(function* (client: BrowserClient) {
  const response = yield* client.json("/two-factor/enable", { password });
  assert.strictEqual(response.status, 200);
  const enrollment = Schema.decodeUnknownSync(TotpEnrollment)(response.body);
  const authenticator = URI.parse(enrollment.totpURI);
  const verified = yield* client.request("/two-factor/verify-totp", {
    code: authenticator.generate(),
  });
  assert.strictEqual(verified.status, 200);
  return { authenticator, backupCodes: enrollment.backupCodes };
});

const failureTag = <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.flip,
    Effect.map((error) => error._tag),
  );

const authTest = (name: string, body: () => Effect.Effect<void, unknown, Fixture | Database>) =>
  it.effect(name, () => body().pipe(Effect.provide(fixture)), { timeout: 60_000 });

authTest("requires an actual email verification before password login", () =>
  Effect.gen(function* () {
    const client = yield* register("alice@example.com");
    assert.strictEqual((yield* signIn(client, "alice@example.com")).status, 403);
    yield* verifyEmail("alice@example.com");
    assert.strictEqual((yield* signIn(client, "alice@example.com")).status, 200);
    const current = yield* client.verify();
    assert.strictEqual(current.user.emailVerified, true);
    assert.strictEqual(current.user.twoFactorEnabled, false);
    assert.strictEqual(current.strong, false);
  }),
);

authTest("admin enrollment session cannot access CRM until real TOTP verification", () =>
  Effect.gen(function* () {
    yield* bootstrapVerifiedAdmin("admin@example.com");
    const client = new BrowserClient((yield* Fixture).admin);
    assert.strictEqual((yield* signIn(client, "admin@example.com")).status, 200);
    assert.strictEqual(yield* failureTag(client.verify()), "AdminMfaRequired");
    assert.strictEqual((yield* client.verify(true)).strong, false);
    yield* enableTotp(client);
    assert.strictEqual((yield* client.verify()).strong, true);
  }),
);

authTest("TOTP sign-in has no usable session until valid second factor", () =>
  Effect.gen(function* () {
    const client = yield* registerVerified("totp@example.com");
    yield* signIn(client, "totp@example.com");
    const { authenticator } = yield* enableTotp(client);
    yield* client.request("/sign-out", {});
    const challenge = yield* client.json("/sign-in/email", { email: "totp@example.com", password });
    assert.deepInclude(challenge.body, { twoFactorRedirect: true });
    assert.strictEqual(yield* failureTag(client.verify()), "SessionRequired");
    assert.isFalse((yield* client.request("/two-factor/verify-totp", { code: "invalid-code" })).ok);
    assert.strictEqual(
      (yield* client.request("/two-factor/verify-totp", { code: authenticator.generate() })).status,
      200,
    );
    assert.strictEqual((yield* client.verify()).strong, true);
  }),
);

authTest("shared signing secret cannot turn a user session into admin session", () =>
  Effect.gen(function* () {
    yield* bootstrapVerifiedAdmin("admin@example.com");
    const { user, admin } = yield* Fixture;
    const client = new BrowserClient(user);
    yield* signIn(client, "admin@example.com");
    const forged = new BrowserClient(admin);
    for (const [key, value] of client.cookies)
      forged.cookies.set(key.replaceAll("template-user", "template-admin"), value);
    assert.strictEqual(yield* failureTag(forged.verify(true)), "SessionInvalid");
  }),
);

authTest("shared signing secret cannot transfer a pending TOTP challenge across apps", () =>
  Effect.gen(function* () {
    yield* bootstrapVerifiedAdmin("admin@example.com");
    const { user, admin } = yield* Fixture;
    const client = new BrowserClient(user);
    yield* signIn(client, "admin@example.com");
    const { authenticator } = yield* enableTotp(client);
    yield* client.request("/sign-out", {});
    yield* signIn(client, "admin@example.com");
    const transferred = new BrowserClient(admin);
    for (const [key, value] of client.cookies)
      transferred.cookies.set(key.replace("template-user", "template-admin"), value);
    const response = yield* transferred.json("/two-factor/verify-totp", {
      code: authenticator.generate(),
    });
    assert.strictEqual(response.status, 403);
    assert.deepInclude(response.body, { message: "CHALLENGE_AUDIENCE_INVALID" });
  }),
);

authTest("HTTP inputs cannot self-assign role, audience or authentication strength", () =>
  Effect.gen(function* () {
    const client = yield* registerVerified("reader@example.com");
    yield* signIn(client, "reader@example.com");
    yield* client.request("/update-user", { role: "admin", securityVersion: 99 });
    yield* client.request("/update-session", {
      audience: "admin",
      authenticationMethod: "passkey_uv",
    });
    const current = yield* client.verify();
    assert.strictEqual(current.user.role, "user");
    assert.strictEqual(current.session.audience, "user");
    assert.strictEqual(current.strong, false);
  }),
);

authTest("admin cannot publicly register and user auth has no admin endpoints", () =>
  Effect.gen(function* () {
    const { user, admin } = yield* Fixture;
    const adminClient = new BrowserClient(admin);
    assert.isFalse(
      (yield* adminClient.request("/sign-up/email", {
        name: "admin",
        email: "admin@example.com",
        password,
      })).ok,
    );
    const userClient = new BrowserClient(user);
    assert.strictEqual((yield* userClient.request("/admin/list-users")).status, 404);
    assert.strictEqual(
      (yield* userClient.request("/admin/set-role", { userId: "x", role: "admin" })).status,
      404,
    );
  }),
);

authTest("revocation invalidates an actual HTTP session", () =>
  Effect.gen(function* () {
    yield* bootstrapVerifiedAdmin("owner@example.com");
    const adminClient = new BrowserClient((yield* Fixture).admin);
    yield* signIn(adminClient, "owner@example.com");
    yield* enableTotp(adminClient);
    const authority = yield* adminClient.verify();
    const target = yield* registerVerified("target@example.com");
    yield* signIn(target, "target@example.com");
    const current = yield* target.verify();
    yield* setUserRole(authority.session.id, current.user.id, "admin");
    assert.strictEqual(yield* failureTag(target.verify()), "SessionRequired");
  }),
);

authTest("old weak admin session cannot enroll another factor after MFA enrollment", () =>
  Effect.gen(function* () {
    yield* bootstrapVerifiedAdmin("admin@example.com");
    const { admin } = yield* Fixture;
    const first = new BrowserClient(admin);
    const old = new BrowserClient(admin);
    yield* signIn(first, "admin@example.com");
    yield* signIn(old, "admin@example.com");
    yield* enableTotp(first);
    const attempt = yield* old.json("/passkey/generate-register-options");
    assert.strictEqual(attempt.status, 403);
    assert.deepInclude(attempt.body, { message: "EXISTING_FACTOR_REQUIRED" });
    assert.isFalse((yield* old.request("/two-factor/verify-totp", { code: "invalid-code" })).ok);
    assert.strictEqual((yield* old.verify(true)).strong, false);
    assert.strictEqual(yield* failureTag(old.verify()), "AdminMfaRequired");
  }),
);

for (const audience of ["user", "admin"] as const) {
  authTest(`weak admin session cannot retrieve TOTP secret through ${audience} app`, () =>
    Effect.gen(function* () {
      const email = "admin@example.com";
      yield* bootstrapVerifiedAdmin(email);
      const services = yield* Fixture;
      const old = new BrowserClient(services[audience]);
      assert.strictEqual((yield* signIn(old, email)).status, 200);
      const enrollment = new BrowserClient(services.admin);
      assert.strictEqual((yield* signIn(enrollment, email)).status, 200);
      const { authenticator } = yield* enableTotp(enrollment);
      const denied = yield* old.json("/two-factor/get-totp-uri", { password });
      assert.strictEqual(denied.status, 403);
      assert.deepInclude(denied.body, { message: "ADMIN_MFA_REQUIRED" });
      assert.notProperty(denied.body, "totpURI");
      assert.strictEqual((yield* old.verify(true)).strong, false);
      assert.strictEqual(
        (yield* old.request("/two-factor/verify-totp", { code: authenticator.generate() })).status,
        200,
      );
      assert.strictEqual((yield* old.verify(true)).strong, true);
      const allowed = yield* old.json("/two-factor/get-totp-uri", { password });
      assert.strictEqual(allowed.status, 200);
      assert.match(String(Reflect.get(Object(allowed.body), "totpURI")), /^otpauth:\/\/totp\//);
    }),
  );

  authTest(`admin recovery session cannot retrieve TOTP secret through ${audience} app`, () =>
    Effect.gen(function* () {
      const email = "admin@example.com";
      yield* bootstrapVerifiedAdmin(email);
      const services = yield* Fixture;
      const enrollment = new BrowserClient(services.admin);
      assert.strictEqual((yield* signIn(enrollment, email)).status, 200);
      const { backupCodes } = yield* enableTotp(enrollment);
      const recovery = new BrowserClient(services[audience]);
      const login = yield* recovery.json("/sign-in/email", { email, password });
      assert.deepInclude(login.body, { twoFactorRedirect: true });
      assert.strictEqual(
        (yield* recovery.request("/two-factor/verify-backup-code", { code: backupCodes[0] }))
          .status,
        200,
      );
      const current = yield* recovery.verify(true);
      assert.strictEqual(current.session.authenticationMethod, "recovery");
      assert.strictEqual(current.strong, false);
      const denied = yield* recovery.json("/two-factor/get-totp-uri", { password });
      assert.strictEqual(denied.status, 403);
      assert.deepInclude(denied.body, { message: "ADMIN_MFA_REQUIRED" });
      assert.notProperty(denied.body, "totpURI");
    }),
  );
}

authTest("regular user can still retrieve TOTP URI with their password", () =>
  Effect.gen(function* () {
    const email = "reader@example.com";
    const enrollment = yield* registerVerified(email);
    assert.strictEqual((yield* signIn(enrollment, email)).status, 200);
    const old = new BrowserClient((yield* Fixture).user);
    assert.strictEqual((yield* signIn(old, email)).status, 200);
    yield* enableTotp(enrollment);
    const current = yield* old.verify();
    assert.strictEqual(current.user.role, "user");
    assert.strictEqual(current.strong, false);
    const response = yield* old.json("/two-factor/get-totp-uri", { password });
    assert.strictEqual(response.status, 200);
    assert.match(String(Reflect.get(Object(response.body), "totpURI")), /^otpauth:\/\/totp\//);
  }),
);

authTest("database exposes every field required by the configured Better Auth plugins", () =>
  Effect.gen(function* () {
    const expected = getSchema((yield* Fixture).user.instance.options);
    const actual = getSchemaShape();
    for (const [model, description] of Object.entries(expected))
      assert.includeMembers(actual[model] ?? [], Object.keys(description.fields));
    assert.strictEqual(expected["passkey"]?.fields["audience"]?.input, false);
    assert.strictEqual(expected["verification"]?.fields["audience"]?.input, false);
  }),
);
