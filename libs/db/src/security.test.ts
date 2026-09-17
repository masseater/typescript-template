import { assert, it } from "@effect/vitest";
import { eq } from "drizzle-orm";
import type { Application, Role } from "@template/config";
import { Effect, Exit } from "effect";
import { deleteUser, listUsers, setUserRole } from "./admin.ts";
import { bootstrapAdmin } from "./bootstrap-statement.ts";
import { getProfile, query, updateProfile } from "./index.ts";
import {
  account,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
  user,
} from "./schema.ts";
import { findWikiReader, getSessionSecurity, revokeUserSessions } from "./security.ts";
import { TestDatabase } from "./testing.ts";

const page = { limit: 50, offset: 0 };

const addUser = (id: string, role: Role = "user") =>
  query((database) =>
    database.insert(user).values({
      id,
      name: id,
      email: `${id}@example.com`,
      role,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );

const addSession = Effect.fn(function* (userId: string, audience: Application, strong = true) {
  const id = crypto.randomUUID();
  const [owner] = yield* query((database) =>
    database.select().from(user).where(eq(user.id, userId)),
  );
  assert.isDefined(owner);
  yield* query((database) =>
    database.insert(session).values({
      id,
      token: crypto.randomUUID(),
      userId,
      audience,
      securityVersion: owner?.securityVersion ?? 0,
      authenticationMethod: strong ? "password_totp" : "password",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }),
  );
  return id;
});

const failureTag = <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.flip,
    Effect.map((error) => error._tag),
  );

it.effect("persists Unicode profiles", () =>
  Effect.gen(function* () {
    yield* addUser("reader");
    yield* updateProfile("reader", { name: "日本語 العربية 🐈", profile: "私は開発者です。" });
    const profile = yield* getProfile("reader");
    assert.strictEqual(profile?.name, "日本語 العربية 🐈");
    assert.strictEqual(profile?.profile, "私は開発者です。");
    assert.strictEqual(
      yield* failureTag(updateProfile("missing", { name: "missing", profile: "" })),
      "UserNotFound",
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("rejects weak admin and cross-audience sessions", () =>
  Effect.gen(function* () {
    yield* addUser("administrator", "admin");
    const weak = yield* addSession("administrator", "admin", false);
    const wrongAudience = yield* addSession("administrator", "user");
    assert.strictEqual(yield* failureTag(listUsers(weak, page)), "AdminStrongSessionRequired");
    assert.strictEqual(
      yield* failureTag(listUsers(wrongAudience, page)),
      "AdminStrongSessionRequired",
    );
    const strong = yield* addSession("administrator", "admin");
    assert.lengthOf((yield* listUsers(strong, page)).users, 1);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("role change invalidates both audiences immediately", () =>
  Effect.gen(function* () {
    yield* addUser("actor", "admin");
    yield* addUser("target", "admin");
    const actor = yield* addSession("actor", "admin");
    const targetAdmin = yield* addSession("target", "admin");
    const targetUser = yield* addSession("target", "user");
    yield* setUserRole(actor, "target", "user");
    assert.isNull(yield* getSessionSecurity(targetAdmin, "admin"));
    assert.isNull(yield* getSessionSecurity(targetUser, "user"));
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("protects final administrator and credentials during deletion", () =>
  Effect.gen(function* () {
    yield* addUser("last", "admin");
    yield* query((database) =>
      database.insert(account).values({
        id: "credential",
        accountId: "last",
        providerId: "credential",
        userId: "last",
        password: "not-used-for-authentication-in-db-test",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const actor = yield* addSession("last", "admin");
    assert.strictEqual(yield* failureTag(deleteUser(actor, "last")), "LastAdminRequired");
    assert.strictEqual(yield* failureTag(setUserRole(actor, "last", "user")), "LastAdminRequired");
    assert.lengthOf(yield* query((database) => database.select().from(account)), 1);
    assert.strictEqual((yield* getSessionSecurity(actor, "admin"))?.user.role, "admin");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("simultaneous self-demotions cannot remove all administrators", () =>
  Effect.gen(function* () {
    yield* addUser("a", "admin");
    yield* addUser("b", "admin");
    const a = yield* addSession("a", "admin");
    const b = yield* addSession("b", "admin");
    const outcomes = yield* Effect.all(
      [Effect.exit(setUserRole(a, "a", "user")), Effect.exit(setUserRole(b, "b", "user"))],
      { concurrency: "unbounded" },
    );
    assert.lengthOf(outcomes.filter(Exit.isSuccess), 1);
    assert.lengthOf(
      yield* query((database) => database.select().from(user).where(eq(user.role, "admin"))),
      1,
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("deletion removes credentials and all sessions", () =>
  Effect.gen(function* () {
    yield* addUser("actor", "admin");
    yield* addUser("target");
    const actor = yield* addSession("actor", "admin");
    const target = yield* addSession("target", "user");
    yield* deleteUser(actor, "target");
    assert.isNull(yield* getProfile("target"));
    assert.isNull(yield* getSessionSecurity(target, "user"));
    assert.strictEqual(yield* failureTag(deleteUser(actor, "target")), "TargetUnavailable");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("first administrator bootstrap is atomic and one-time", () =>
  Effect.gen(function* () {
    yield* addUser("a");
    yield* addUser("b");
    const outcomes = yield* Effect.all(
      [Effect.exit(bootstrapAdmin("a@example.com")), Effect.exit(bootstrapAdmin("b@example.com"))],
      { concurrency: "unbounded" },
    );
    assert.lengthOf(outcomes.filter(Exit.isSuccess), 1);
  }).pipe(Effect.provide(TestDatabase)),
);

const addOAuthGrant = Effect.fn(function* (userId: string) {
  const clientId = `client-${userId}`;
  yield* query((database) =>
    database.insert(oauthClient).values({ id: clientId, clientId, redirectUris: "[]" }),
  );
  yield* query((database) =>
    database.insert(oauthRefreshToken).values({
      id: `refresh-${userId}`,
      token: `refresh-token-${userId}`,
      clientId,
      userId,
      scopes: '["wiki:read"]',
    }),
  );
  yield* query((database) =>
    database.insert(oauthAccessToken).values({
      id: `access-${userId}`,
      token: `access-token-${userId}`,
      clientId,
      userId,
      refreshId: `refresh-${userId}`,
      scopes: '["wiki:read"]',
    }),
  );
  yield* query((database) =>
    database.insert(oauthConsent).values({
      id: `consent-${userId}`,
      clientId,
      userId,
      scopes: '["wiki:read"]',
    }),
  );
});

const oauthGrantCounts = Effect.fn(function* (userId: string) {
  const access = yield* query((database) =>
    database.select().from(oauthAccessToken).where(eq(oauthAccessToken.userId, userId)),
  );
  const refresh = yield* query((database) =>
    database.select().from(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId)),
  );
  const consent = yield* query((database) =>
    database.select().from(oauthConsent).where(eq(oauthConsent.userId, userId)),
  );
  return { access: access.length, refresh: refresh.length, consent: consent.length };
});

it.effect("role change revokes wiki reading and every OAuth grant of the user", () =>
  Effect.gen(function* () {
    yield* addUser("actor", "admin");
    yield* addUser("reader", "admin");
    const actor = yield* addSession("actor", "admin");
    yield* addOAuthGrant("reader");
    assert.deepStrictEqual(yield* findWikiReader("reader"), { id: "reader" });
    yield* setUserRole(actor, "reader", "user");
    assert.isNull(yield* findWikiReader("reader"));
    assert.deepStrictEqual(yield* oauthGrantCounts("reader"), {
      access: 0,
      refresh: 0,
      consent: 0,
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("revoking sessions also revokes OAuth tokens but keeps consent", () =>
  Effect.gen(function* () {
    yield* addUser("reader", "admin");
    const wiki = yield* addSession("reader", "wiki");
    yield* addOAuthGrant("reader");
    yield* revokeUserSessions("reader");
    assert.isNull(yield* getSessionSecurity(wiki, "wiki"));
    assert.deepStrictEqual(yield* oauthGrantCounts("reader"), {
      access: 0,
      refresh: 0,
      consent: 1,
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("deleting a user removes OAuth grants", () =>
  Effect.gen(function* () {
    yield* addUser("actor", "admin");
    yield* addUser("reader");
    const actor = yield* addSession("actor", "admin");
    yield* addOAuthGrant("reader");
    yield* deleteUser(actor, "reader");
    assert.deepStrictEqual(yield* oauthGrantCounts("reader"), {
      access: 0,
      refresh: 0,
      consent: 0,
    });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("wiki reading requires a verified administrator", () =>
  Effect.gen(function* () {
    yield* addUser("member");
    yield* query((database) =>
      database.insert(user).values({
        id: "unverified",
        name: "unverified",
        email: "unverified@example.com",
        role: "admin",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    assert.isNull(yield* findWikiReader("member"));
    assert.isNull(yield* findWikiReader("unverified"));
    assert.isNull(yield* findWikiReader("missing"));
  }).pipe(Effect.provide(TestDatabase)),
);
