import { ACCOUNT_STATE, APPLICATION, ROLE } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { deleteUser } from "./admin.ts";
import { TestDatabase } from "./database-test-fixture.ts";
import { addOAuthGrant, addSession, addUser, oauthGrantCounts } from "./records-test-fixture.ts";
import { findWikiReader, getSessionSecurity, revokeUserSessions } from "./security.ts";
import { removeStaff } from "./staff.ts";

describe("findWikiReader", () => {
  describe("a verified staff member", () => {
    const it = test.extend("wikiReader", () =>
      Effect.runPromise(
        Effect.gen(function* findStaff() {
          yield* addUser({ role: ROLE.staff, userId: "reader" });
          return yield* findWikiReader("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("reads the wiki", ({ wikiReader }) => {
      expect(wikiReader).toStrictEqual({ id: "reader" });
    });
  });

  describe.for([
    ["a member", { userId: "member" }, "member"],
    ["an administrator", { role: ROLE.administrator, userId: "admin" }, "admin"],
    [
      "an unverified staff member",
      { emailVerified: false, role: ROLE.staff, userId: "unverified" },
      "unverified",
    ],
    [
      "a suspended staff member",
      { accountState: ACCOUNT_STATE.suspended, role: ROLE.staff, userId: "suspended" },
      "suspended",
    ],
    ["a user who does not exist", undefined, "missing"],
  ] as const)("%s", ([, addedUser, readerId]) => {
    const it = test.extend("wikiReader", () =>
      Effect.runPromise(
        Effect.gen(function* findOther() {
          if (addedUser !== undefined) yield* addUser(addedUser);
          return yield* findWikiReader(readerId);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("does not read the wiki", ({ wikiReader }) => {
      expect(wikiReader).toBe(undefined);
    });
  });

  describe("a staff member who was removed", () => {
    const it = test.extend("wikiReader", () =>
      Effect.runPromise(
        Effect.gen(function* removeReader() {
          yield* addUser({ role: ROLE.staff, userId: "actor" });
          yield* addUser({ role: ROLE.staff, userId: "reader" });
          const sessionId = yield* addSession({ audience: APPLICATION.wiki, userId: "actor" });
          yield* removeStaff(sessionId, "reader");
          return yield* findWikiReader("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("stops reading the wiki", ({ wikiReader }) => {
      expect(wikiReader).toBe(undefined);
    });
  });
});

describe("OAuth grants", () => {
  describe("of a staff member who was removed", () => {
    const it = test.extend("grantCounts", () =>
      Effect.runPromise(
        Effect.gen(function* removeGrantee() {
          yield* addUser({ role: ROLE.staff, userId: "actor" });
          yield* addUser({ role: ROLE.staff, userId: "reader" });
          const sessionId = yield* addSession({ audience: APPLICATION.wiki, userId: "actor" });
          yield* addOAuthGrant("reader");
          yield* removeStaff(sessionId, "reader");
          return yield* oauthGrantCounts("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("are all revoked", ({ grantCounts }) => {
      expect(grantCounts).toStrictEqual({ access: 0, consent: 0, refresh: 0 });
    });
  });

  describe("of a user whose sessions were revoked", () => {
    const it = test.extend("grantCounts", () =>
      Effect.runPromise(
        Effect.gen(function* revokeGrantee() {
          yield* addUser({ role: ROLE.staff, userId: "reader" });
          yield* addOAuthGrant("reader");
          yield* revokeUserSessions("reader");
          return yield* oauthGrantCounts("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("lose their tokens but keep the consent", ({ grantCounts }) => {
      expect(grantCounts).toStrictEqual({ access: 0, consent: 1, refresh: 0 });
    });
  });

  describe("of a deleted user", () => {
    const it = test.extend("grantCounts", () =>
      Effect.runPromise(
        Effect.gen(function* deleteGrantee() {
          yield* addUser({ role: ROLE.administrator, userId: "actor" });
          yield* addUser({ userId: "reader" });
          const sessionId = yield* addSession({
            audience: APPLICATION.admin,
            userId: "actor",
          });
          yield* addOAuthGrant("reader");
          yield* deleteUser({ sessionId, targetId: "reader" });
          return yield* oauthGrantCounts("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("are all removed", ({ grantCounts }) => {
      expect(grantCounts).toStrictEqual({ access: 0, consent: 0, refresh: 0 });
    });
  });
});

describe("revokeUserSessions", () => {
  describe("a wiki session of the revoked user", () => {
    const it = test.extend("revokedSession", () =>
      Effect.runPromise(
        Effect.gen(function* revokeWiki() {
          yield* addUser({ role: ROLE.staff, userId: "reader" });
          const sessionId = yield* addSession({
            audience: APPLICATION.wiki,
            userId: "reader",
          });
          yield* revokeUserSessions("reader");
          return yield* getSessionSecurity(sessionId, APPLICATION.wiki);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is no longer live", ({ revokedSession }) => {
      expect(revokedSession).toBe(undefined);
    });
  });
});
