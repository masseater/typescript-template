import { addOAuthGrant, addSession, addUser, oauthGrantCounts } from "./records-fixture.ts";
import { assert, it } from "@effect/vitest";
import { deleteUser, setUserRole } from "./admin.ts";
import { findWikiReader, getSessionSecurity, revokeUserSessions } from "./security.ts";
import { Effect } from "effect";
import { TestDatabase } from "./testing.ts";

const noGrants = { access: 0, consent: 0, refresh: 0 };

it.effect("role change revokes wiki reading and every OAuth grant of the user", () =>
  Effect.gen(function* program() {
    yield* addUser("actor", "admin");
    yield* addUser("reader", "admin");
    const actor = yield* addSession("actor", "admin");
    yield* addOAuthGrant("reader");
    assert.deepStrictEqual(yield* findWikiReader("reader"), { id: "reader" });
    yield* setUserRole(actor, "reader", "user");
    assert.isNull(yield* findWikiReader("reader"));
    assert.deepStrictEqual(yield* oauthGrantCounts("reader"), noGrants);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("revoking sessions also revokes OAuth tokens but keeps consent", () =>
  Effect.gen(function* program() {
    yield* addUser("reader", "admin");
    const wiki = yield* addSession("reader", "wiki");
    yield* addOAuthGrant("reader");
    yield* revokeUserSessions("reader");
    assert.isNull(yield* getSessionSecurity(wiki, "wiki"));
    assert.deepStrictEqual(yield* oauthGrantCounts("reader"), { ...noGrants, consent: 1 });
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("deleting a user removes OAuth grants", () =>
  Effect.gen(function* program() {
    yield* addUser("actor", "admin");
    yield* addUser("reader");
    const actor = yield* addSession("actor", "admin");
    yield* addOAuthGrant("reader");
    yield* deleteUser(actor, "reader");
    assert.deepStrictEqual(yield* oauthGrantCounts("reader"), noGrants);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("wiki reading requires a verified administrator", () =>
  Effect.gen(function* program() {
    yield* addUser("member");
    yield* addUser("unverified", "admin", false);
    assert.isNull(yield* findWikiReader("member"));
    assert.isNull(yield* findWikiReader("unverified"));
    assert.isNull(yield* findWikiReader("missing"));
  }).pipe(Effect.provide(TestDatabase)),
);
