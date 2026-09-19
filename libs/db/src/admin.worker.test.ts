import { assert, it } from "@effect/vitest";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { deleteUser, listUsers, setUserRole } from "./admin.ts";
import { bootstrapAdmin } from "./bootstrap-statement.ts";
import { getProfile, query, updateProfile } from "./index.ts";
import { addCredential, addSession, addUser, failureTag, successCount } from "./records-fixture.ts";
import { account, auditEvent, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";
import { TestDatabase } from "./testing.ts";

import type { Database } from "./index.ts";

const page = { limit: 50, offset: 0 };

function auditRecords(): Effect.Effect<readonly unknown[], unknown, Database> {
  return query(async (database) => database.select().from(auditEvent));
}

it.effect("persists Unicode profiles", () =>
  Effect.gen(function* program() {
    yield* addUser("reader");
    yield* updateProfile("reader", {
      name: "日本語 العربية 🐈",
      profile: "私は開発者です。",
      socialLinks: ["https://github.com/reader"],
    });
    const profile = yield* getProfile("reader");
    assert.strictEqual(profile?.name, "日本語 العربية 🐈");
    assert.strictEqual(profile?.profile, "私は開発者です。");
    assert.deepStrictEqual(profile?.socialLinks, ["https://github.com/reader"]);
    assert.strictEqual(
      yield* failureTag(
        updateProfile("missing", { name: "missing", profile: "", socialLinks: [] }),
      ),
      "UserNotFound",
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("rejects weak admin and cross-audience sessions", () =>
  Effect.gen(function* program() {
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
  Effect.gen(function* program() {
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
  Effect.gen(function* program() {
    yield* addUser("last", "admin");
    yield* addCredential("last");
    const actor = yield* addSession("last", "admin");
    assert.strictEqual(yield* failureTag(deleteUser(actor, "last")), "LastAdminRequired");
    assert.strictEqual(yield* failureTag(setUserRole(actor, "last", "user")), "LastAdminRequired");
    assert.lengthOf(yield* query(async (database) => database.select().from(account)), 1);
    assert.strictEqual((yield* getSessionSecurity(actor, "admin"))?.user.role, "admin");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("simultaneous self-demotions cannot remove all administrators", () =>
  Effect.gen(function* program() {
    yield* addUser("first", "admin");
    yield* addUser("second", "admin");
    const first = yield* addSession("first", "admin");
    const second = yield* addSession("second", "admin");
    const outcomes = yield* Effect.all(
      [
        Effect.exit(setUserRole(first, "first", "user")),
        Effect.exit(setUserRole(second, "second", "user")),
      ],
      { concurrency: "unbounded" },
    );
    assert.strictEqual(successCount(outcomes), 1);
    const admins = yield* query(async (database) =>
      database.select().from(user).where(eq(user.role, "admin")),
    );
    assert.lengthOf(admins, 1);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("deletion removes credentials and all sessions", () =>
  Effect.gen(function* program() {
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
  Effect.gen(function* program() {
    yield* addUser("first");
    yield* addUser("second");
    const outcomes = yield* Effect.all(
      [
        Effect.exit(bootstrapAdmin("first@example.com")),
        Effect.exit(bootstrapAdmin("second@example.com")),
      ],
      { concurrency: "unbounded" },
    );
    assert.strictEqual(successCount(outcomes), 1);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("writes an audit record only when the user change lands", () =>
  Effect.gen(function* program() {
    yield* addUser("actor", "admin");
    yield* addUser("target");
    const actor = yield* addSession("actor", "admin");
    assert.strictEqual(yield* failureTag(deleteUser(actor, "missing")), "TargetUnavailable");
    assert.strictEqual(
      yield* failureTag(setUserRole(actor, "missing", "admin")),
      "TargetUnavailable",
    );
    assert.lengthOf(yield* auditRecords(), 0);
    yield* setUserRole(actor, "target", "admin");
    assert.lengthOf(yield* auditRecords(), 1);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("a rejected user change leaves no audit record behind", () =>
  Effect.gen(function* program() {
    yield* addUser("last", "admin");
    const actor = yield* addSession("last", "admin");
    assert.strictEqual(yield* failureTag(setUserRole(actor, "last", "user")), "LastAdminRequired");
    assert.strictEqual(yield* failureTag(deleteUser(actor, "last")), "LastAdminRequired");
    assert.lengthOf(yield* auditRecords(), 0);
  }).pipe(Effect.provide(TestDatabase)),
);
