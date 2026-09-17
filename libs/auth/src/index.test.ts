import { assert, it } from "@effect/vitest";
import { sendVerificationEmail } from "@template/config";
import type { Application } from "@template/config";
import type { Database } from "@template/db";
import { setUserRole } from "@template/db/admin";
import {
  EmptyTestDatabase,
  TestBinding,
  TestDatabase,
  bootstrapAdmin,
  getSchemaShape,
} from "@template/db/testing";
import { getSchema } from "better-auth/db";
import { Context, Effect, Layer, Schema } from "effect";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { URI } from "otpauth";
import { Auth, verifySession } from "./index.ts";
import { authorizeMcpRequest } from "./mcp.ts";

const password = "test-password-safe-123";
const secret = "integration-test-secret-at-least-32-characters-long";
const mailConfig = {
  EMAIL_FROM: "no-reply@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
};
const origins = {
  user: "http://localhost:4101",
  admin: "http://localhost:4102",
  wiki: "http://localhost:4103",
} as const;

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
    const headers = this.headers();
    headers.set("content-type", "application/json");
    return this.send(
      new Request(`${this.origin}/api/auth${endpoint}`, {
        method: body ? "POST" : "GET",
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  }

  navigate(url: string) {
    const headers = this.headers();
    headers.set("accept", "text/html");
    return this.send(new Request(url, { headers, redirect: "manual" }));
  }

  send(request: Request) {
    return Effect.promise(async () => {
      const response = await this.auth.instance.handler(request);
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
        Effect.promise(async () => ({
          status: response.status,
          body: (await response.json()) as unknown,
        })),
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

const authFor = (audience: Application) =>
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
  { readonly user: AuthService; readonly admin: AuthService; readonly wiki: AuthService }
>()("Fixture") {}

const fixture = Layer.effect(
  Fixture,
  Effect.gen(function* () {
    return Fixture.of({
      user: yield* authFor("user"),
      admin: yield* authFor("admin"),
      wiki: yield* authFor("wiki"),
    });
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

const authTest = (
  name: string,
  body: () => Effect.Effect<void, unknown, Fixture | Database | TestBinding>,
) => it.effect(name, () => body().pipe(Effect.provide(fixture)), { timeout: 60_000 });

it.effect(
  "wiki auth finishes OAuth provider initialization while its layer is built",
  () =>
    Effect.gen(function* () {
      assert.strictEqual(yield* failureTag(Effect.scoped(authFor("wiki"))), "AuthFailure");
      assert.strictEqual((yield* Effect.scoped(authFor("user"))).audience, "user");
    }).pipe(Effect.provide(EmptyTestDatabase)),
  { timeout: 60_000 },
);

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

for (const name of ["user", "wiki"] as const)
  authTest(`database exposes every field required by the ${name} plugins`, () =>
    Effect.gen(function* () {
      const expected = getSchema((yield* Fixture)[name].instance.options);
      const actual = getSchemaShape();
      for (const [model, description] of Object.entries(expected))
        assert.includeMembers(actual[model] ?? [], Object.keys(description.fields));
      assert.strictEqual(expected["passkey"]?.fields["audience"]?.input, false);
      assert.strictEqual(expected["verification"]?.fields["audience"]?.input, false);
    }),
  );

const wikiOrigin = origins.wiki;
const redirectUri = "http://127.0.0.1:43123/callback";
const Redirect = Schema.Struct({ url: Schema.String });

const base64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

const wikiAdministrator = Effect.fn(function* (email: string) {
  yield* bootstrapVerifiedAdmin(email);
  const services = yield* Fixture;
  const admin = new BrowserClient(services.admin);
  yield* signIn(admin, email);
  const { authenticator } = yield* enableTotp(admin);
  const wiki = new BrowserClient(services.wiki);
  const challenge = yield* wiki.json("/sign-in/email", { email, password });
  assert.deepInclude(challenge.body, { twoFactorRedirect: true });
  assert.strictEqual(
    (yield* wiki.request("/two-factor/verify-totp", { code: authenticator.generate() })).status,
    200,
  );
  return wiki;
});

const startAuthorization = Effect.fn(function* () {
  const anonymous = new BrowserClient((yield* Fixture).wiki);
  const registration = yield* anonymous.json("/oauth2/register", {
    client_name: "Test MCP client",
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
  assert.strictEqual(registration.status, 201);
  const { client_id: clientId } = Schema.decodeUnknownSync(
    Schema.Struct({ client_id: Schema.String }),
  )(registration.body);
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(
      yield* Effect.promise(() =>
        crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
      ),
    ),
  );
  const authorize = new URL(`${wikiOrigin}/api/auth/oauth2/authorize`);
  for (const [key, value] of Object.entries({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "wiki:read offline_access",
    state: "state-value",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: `${wikiOrigin}/mcp`,
  }))
    authorize.searchParams.set(key, value);
  const redirect = yield* anonymous.navigate(authorize.href);
  assert.strictEqual(redirect.status, 302);
  const login = new URL(redirect.headers.get("location") ?? "", wikiOrigin);
  assert.strictEqual(login.pathname, "/login");
  return { clientId, verifier, oauthQuery: login.search.slice(1) };
});

const grantAuthorization = Effect.fn(function* (wiki: BrowserClient, oauthQuery: string) {
  const continued = yield* wiki.json("/oauth2/continue", {
    postLogin: true,
    oauth_query: oauthQuery,
  });
  assert.strictEqual(continued.status, 200);
  const next = new URL(Schema.decodeUnknownSync(Redirect)(continued.body).url, wikiOrigin);
  assert.strictEqual(next.pathname, "/consent");
  const consented = yield* wiki.json("/oauth2/consent", {
    accept: true,
    oauth_query: next.search.slice(1),
  });
  assert.strictEqual(consented.status, 200);
  const callback = new URL(Schema.decodeUnknownSync(Redirect)(consented.body).url);
  assert.strictEqual(`${callback.origin}${callback.pathname}`, redirectUri);
  assert.strictEqual(callback.searchParams.get("state"), "state-value");
  const code = callback.searchParams.get("code");
  assert.isString(code);
  return code ?? "";
});

const exchangeCode = Effect.fn(function* (
  flow: { readonly clientId: string; readonly verifier: string },
  code: string,
) {
  const { wiki } = yield* Fixture;
  const response = yield* Effect.promise(() =>
    wiki.instance.handler(
      new Request(`${wikiOrigin}/api/auth/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: flow.verifier,
          client_id: flow.clientId,
          redirect_uri: redirectUri,
          resource: `${wikiOrigin}/mcp`,
        }),
      }),
    ),
  );
  assert.strictEqual(response.status, 200);
  return Schema.decodeUnknownSync(Schema.Struct({ access_token: Schema.String }))(
    yield* Effect.promise(() => response.json()),
  );
});

const mcpRequest = Effect.fn(function* (token?: string) {
  const { wiki } = yield* Fixture;
  return yield* authorizeMcpRequest(
    new Request(`${wikiOrigin}/mcp`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
    wikiOrigin,
  ).pipe(Effect.provideService(Auth, wiki));
});

authTest("wiki publishes OAuth discovery for its MCP resource", () =>
  Effect.gen(function* () {
    const { wiki } = yield* Fixture;
    const discovery = (path: string) =>
      Effect.promise(async () => {
        const response = await wiki.instance.handler(new Request(`${wikiOrigin}${path}`));
        return { status: response.status, body: (await response.json()) as unknown };
      });
    const resource = yield* discovery("/.well-known/oauth-protected-resource/mcp");
    assert.strictEqual(resource.status, 200);
    assert.deepInclude(resource.body, {
      resource: `${wikiOrigin}/mcp`,
      authorization_servers: [`${wikiOrigin}/api/auth`],
    });
    const server = yield* discovery("/.well-known/oauth-authorization-server/api/auth");
    assert.strictEqual(server.status, 200);
    assert.deepInclude(server.body, {
      issuer: `${wikiOrigin}/api/auth`,
      registration_endpoint: `${wikiOrigin}/api/auth/oauth2/register`,
      code_challenge_methods_supported: ["S256"],
    });
    const challenge = yield* mcpRequest();
    assert.instanceOf(challenge, Response);
    if (challenge instanceof Response) {
      assert.strictEqual(challenge.status, 401);
      assert.include(
        challenge.headers.get("www-authenticate") ?? "",
        `resource_metadata="${wikiOrigin}/.well-known/oauth-protected-resource/mcp"`,
      );
    }
  }),
);

authTest("strong wiki administrator authorizes an MCP client that can then read the wiki", () =>
  Effect.gen(function* () {
    const flow = yield* startAuthorization();
    const wiki = yield* wikiAdministrator("owner@example.com");
    const code = yield* grantAuthorization(wiki, flow.oauthQuery);
    const tokens = yield* exchangeCode(flow, code);
    const granted = yield* mcpRequest(tokens.access_token);
    assert.notInstanceOf(granted, Response);
    if (!(granted instanceof Response)) assert.match(granted.userId, /^.+$/);
    const tampered = yield* mcpRequest(`${tokens.access_token.slice(0, -2)}xx`);
    assert.instanceOf(tampered, Response);
    if (tampered instanceof Response) assert.strictEqual(tampered.status, 401);
  }),
);

authTest("demoted administrator loses MCP access even with an unexpired token", () =>
  Effect.gen(function* () {
    const flow = yield* startAuthorization();
    const wiki = yield* wikiAdministrator("owner@example.com");
    const tokens = yield* exchangeCode(flow, yield* grantAuthorization(wiki, flow.oauthQuery));
    const owner = yield* wiki.verify();
    yield* registerVerified("second@example.com");
    const binding = yield* TestBinding;
    yield* Effect.promise(() =>
      binding
        .prepare("UPDATE user SET role = 'admin' WHERE email = ?")
        .bind("second@example.com")
        .run(),
    );
    yield* Effect.promise(() =>
      binding.prepare("UPDATE user SET role = 'user' WHERE id = ?").bind(owner.user.id).run(),
    );
    assert.strictEqual(yield* failureTag(wiki.verify()), "SessionRequired");
    const denied = yield* mcpRequest(tokens.access_token);
    assert.instanceOf(denied, Response);
    if (denied instanceof Response) assert.strictEqual(denied.status, 403);
  }),
);

authTest("wiki sign-in never sends a verification email it has no page for", () =>
  Effect.gen(function* () {
    yield* register("pending@example.com");
    mailbox.delete("pending@example.com");
    const services = yield* Fixture;
    const wiki = new BrowserClient(services.wiki);
    assert.strictEqual((yield* signIn(wiki, "pending@example.com")).status, 403);
    assert.isFalse(mailbox.has("pending@example.com"));
    const user = new BrowserClient(services.user);
    assert.strictEqual((yield* signIn(user, "pending@example.com")).status, 403);
    assert.isTrue(mailbox.has("pending@example.com"));
  }),
);

authTest("weak or non-administrator wiki sessions cannot grant MCP access", () =>
  Effect.gen(function* () {
    const flow = yield* startAuthorization();
    yield* bootstrapVerifiedAdmin("owner@example.com");
    const services = yield* Fixture;
    const weak = new BrowserClient(services.wiki);
    assert.strictEqual((yield* signIn(weak, "owner@example.com")).status, 200);
    const continued = yield* weak.json("/oauth2/continue", {
      postLogin: true,
      oauth_query: flow.oauthQuery,
    });
    assert.strictEqual(continued.status, 403);
    assert.deepInclude(continued.body, { message: "ADMIN_MFA_REQUIRED" });

    const smuggled = new BrowserClient(services.wiki);
    const signInWithQuery = yield* smuggled.json("/sign-in/email", {
      email: "owner@example.com",
      password,
      oauth_query: flow.oauthQuery,
    });
    assert.strictEqual(signInWithQuery.status, 403);
    assert.deepInclude(signInWithQuery.body, { message: "OAUTH_QUERY_NOT_ACCEPTED" });

    yield* registerVerified("member@example.com");
    const member = new BrowserClient(services.wiki);
    assert.isFalse((yield* signIn(member, "member@example.com")).ok);
    assert.isFalse(
      (yield* member.request("/sign-up/email", {
        name: "new",
        email: "new@example.com",
        password,
      })).ok,
    );
  }),
);
