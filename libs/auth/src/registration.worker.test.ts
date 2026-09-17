import {
  Fixture,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  HTTP_OK,
  PASSWORD,
  TEST_TIMEOUT,
  register,
  registerVerified,
  signIn,
  withAuth,
} from "./auth-test-fixture.ts";
import { assert, it } from "@effect/vitest";
import { BrowserClient } from "./browser-client.ts";
import { Effect } from "effect";
import { getSchema } from "better-auth/db";
import { getSchemaShape } from "@template/db/testing";
import { mailbox } from "./mail-fixture.ts";

const verifyEmailOf = Effect.fn("verifyEmailOf")(function* verifyEmailOf(email: string) {
  const { user } = yield* Fixture;
  const link = new URL(mailbox.get(email) ?? "http://invalid.test/");
  const token = new URLSearchParams(link.hash.slice(1)).get("token") ?? "";
  yield* Effect.promise(async () => user.instance.api.verifyEmail({ query: { token } }));
});

it.effect(
  "requires an actual email verification before password login",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const client = yield* register("alice@example.com");
        assert.strictEqual((yield* signIn(client, "alice@example.com")).status, HTTP_FORBIDDEN);
        yield* verifyEmailOf("alice@example.com");
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
  "HTTP inputs cannot self-assign role, audience or authentication strength",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const client = yield* registerVerified("reader@example.com");
        yield* signIn(client, "reader@example.com");
        yield* client.request("/update-user", { role: "admin", securityVersion: 99 });
        yield* client.request("/update-session", {
          audience: "admin",
          authenticationMethod: "passkey_uv",
        });
        const current = yield* client.verify();
        assert.deepStrictEqual(
          [current.user.role, current.session.audience, current.strong],
          ["user", "user", false],
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
        const { user, admin } = yield* Fixture;
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
        const wiki = new BrowserClient(services.wiki);
        assert.strictEqual((yield* signIn(wiki, "pending@example.com")).status, HTTP_FORBIDDEN);
        assert.isFalse(mailbox.has("pending@example.com"));
        const user = new BrowserClient(services.user);
        assert.strictEqual((yield* signIn(user, "pending@example.com")).status, HTTP_FORBIDDEN);
        assert.isTrue(mailbox.has("pending@example.com"));
      }),
    ),
  TEST_TIMEOUT,
);

for (const name of ["user", "wiki"] as const) {
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
