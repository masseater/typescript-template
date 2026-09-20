import { assert, it } from "@effect/vitest";
import { getSchemaShape } from "@repo/db/testing";
import { getSchema } from "better-auth/db";
import { Effect, Schema } from "effect";

import {
  Fixture,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  HTTP_OK,
  PASSWORD,
  TEST_TIMEOUT,
  decodeOrDie,
  receivedLink,
  register,
  registerVerified,
  signIn,
  verifyEmail,
  withAuth,
} from "./auth-test-fixture.ts";
import { BrowserClient, origins } from "./browser-client.ts";
import { mailSubjects } from "./email.ts";
import { mailbox } from "./mail-fixture.ts";

const SignUpResponse = Schema.Struct({
  token: Schema.NullOr(Schema.String),
  user: Schema.Record(Schema.String, Schema.Unknown),
});

const signUpShape = Effect.fn("signUpShape")(function* signUpShape(email: string) {
  const member = (yield* Fixture)["service-member"];
  const signUp = { email, name: email, password: PASSWORD };
  const response = yield* new BrowserClient(member).json("/sign-up/email", signUp);
  const body = yield* decodeOrDie(SignUpResponse, response.body);
  return { fields: Object.keys(body.user).toSorted(), status: response.status, token: body.token };
});

it.effect(
  "requires an actual email verification before password login",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const client = yield* register("alice@example.com");
        assert.strictEqual((yield* signIn(client, "alice@example.com")).status, HTTP_FORBIDDEN);
        yield* verifyEmail("alice@example.com");
        assert.strictEqual((yield* signIn(client, "alice@example.com")).status, HTTP_OK);
        const current = yield* client.verify();
        assert.deepStrictEqual(
          [current.user.emailVerified, current.user.twoFactorEnabled, current.strong],
          [true, false, false],
        );
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "signing up with a registered address answers exactly like a new sign-up",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* registerVerified("taken@example.com");
        const fresh = yield* signUpShape("fresh@example.com");
        const taken = yield* signUpShape("taken@example.com");
        assert.deepStrictEqual(taken, fresh);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "a verified owner gets one login link per notice window and keeps the account",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* registerVerified("taken@example.com");
        mailbox.delete("taken@example.com");
        const client = yield* register("taken@example.com");
        const notice = receivedLink("taken@example.com", mailSubjects.existingAccount);
        assert.strictEqual(notice.href, new URL("/login", origins["service-member"]).href);
        mailbox.delete("taken@example.com");
        yield* register("taken@example.com");
        assert.isFalse(mailbox.has("taken@example.com"));
        assert.strictEqual((yield* signIn(client, "taken@example.com")).status, HTTP_OK);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "an unverified owner signing up again gets a fresh verification link",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* register("unverified@example.com");
        mailbox.delete("unverified@example.com");
        const client = yield* register("unverified@example.com");
        yield* verifyEmail("unverified@example.com");
        assert.strictEqual((yield* signIn(client, "unverified@example.com")).status, HTTP_OK);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "HTTP inputs cannot self-assign role, audience or authentication strength",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const client = yield* registerVerified("reader@example.com");
        yield* signIn(client, "reader@example.com");
        yield* client.request("/update-user", { role: "admin", securityVersion: 99 });
        yield* client.request("/update-session", {
          audience: "service-admin",
          authenticationMethod: "passkey_uv",
        });
        const current = yield* client.verify();
        assert.deepStrictEqual(
          [current.user.role, current.session.audience, current.strong],
          ["member", "service-member", false],
        );
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "admin cannot publicly register and user auth has no admin endpoints",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const services = yield* Fixture;
        const user = services["service-member"];
        const admin = services["service-admin"];
        const signUp = { email: "admin@example.com", name: "admin", password: PASSWORD };
        assert.isFalse((yield* new BrowserClient(admin).request("/sign-up/email", signUp)).ok);
        const userClient = new BrowserClient(user);
        assert.strictEqual((yield* userClient.request("/admin/list-users")).status, HTTP_NOT_FOUND);
        const setRole = { role: "admin", userId: "x" };
        assert.strictEqual(
          (yield* userClient.request("/admin/set-role", setRole)).status,
          HTTP_NOT_FOUND,
        );
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "wiki sign-in never sends a verification email it has no page for",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* register("pending@example.com");
        mailbox.delete("pending@example.com");
        const services = yield* Fixture;
        const wiki = new BrowserClient(services["internal-dashboard"]);
        assert.strictEqual((yield* signIn(wiki, "pending@example.com")).status, HTTP_FORBIDDEN);
        assert.isFalse(mailbox.has("pending@example.com"));
        const user = new BrowserClient(services["service-member"]);
        assert.strictEqual((yield* signIn(user, "pending@example.com")).status, HTTP_FORBIDDEN);
        assert.isTrue(mailbox.has("pending@example.com"));
      }),
    ),
  TEST_TIMEOUT,
);

for (const name of ["service-member", "internal-dashboard"] as const) {
  it.effect(
    `database exposes every field required by the ${name} plugins`,
    () =>
      withAuth(
        Effect.gen(function* program() {
          const expected = getSchema((yield* Fixture)[name].instance.options);
          const actual = getSchemaShape();
          for (const [model, description] of Object.entries(expected)) {
            assert.includeMembers(actual[model] ?? [], Object.keys(description.fields));
          }
          const audienceInputs = [
            expected["passkey"]?.fields["audience"]?.input,
            expected["verification"]?.fields["audience"]?.input,
          ];
          assert.deepStrictEqual(audienceInputs, [false, false]);
        }),
      ),
    TEST_TIMEOUT,
  );
}
