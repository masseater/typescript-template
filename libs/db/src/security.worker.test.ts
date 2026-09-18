import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { deleteUser, setUserRole } from "./admin.ts";
import { findWikiReader, getSessionSecurity, revokeUserSessions } from "./security.ts";
import { addOAuthGrant, addSession, addUser, oauthGrantCounts, TestDatabase } from "./testing.ts";

describe("findWikiReader", () => {
  describe("a verified administrator", () => {
    const it = test.extend("wikiReader", async () =>
      Effect.runPromise(
        Effect.gen(function* findAdministrator() {
          yield* addUser({ role: "admin", userId: "reader" });
          return yield* findWikiReader("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("reads the wiki", ({ wikiReader }) => {
      expect(wikiReader).toStrictEqual({ id: "reader" });
    });
  });

  describe.for([
    ["a member", { userId: "member" }, "member"],
    [
      "an unverified administrator",
      { emailVerified: false, role: "admin", userId: "unverified" },
      "unverified",
    ],
    ["a user who does not exist", undefined, "missing"],
  ] as const)("%s", ([, addedUser, readerId]) => {
    const it = test.extend("wikiReader", async () =>
      Effect.runPromise(
        Effect.gen(function* findOther() {
          if (addedUser !== undefined) yield* addUser(addedUser);
          return yield* findWikiReader(readerId);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("does not read the wiki", ({ wikiReader }) => {
      expect(wikiReader).toBe(null);
    });
  });

  describe("an administrator demoted to member", () => {
    const it = test.extend("wikiReader", async () =>
      Effect.runPromise(
        Effect.gen(function* demoteReader() {
          yield* addUser({ role: "admin", userId: "actor" });
          yield* addUser({ role: "admin", userId: "reader" });
          const sessionId = yield* addSession({ audience: "admin", userId: "actor" });
          yield* setUserRole({ role: "user", sessionId, targetId: "reader" });
          return yield* findWikiReader("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("stops reading the wiki", ({ wikiReader }) => {
      expect(wikiReader).toBe(null);
    });
  });
});

describe("OAuth grants", () => {
  describe("of an administrator demoted to member", () => {
    const it = test.extend("grantCounts", async () =>
      Effect.runPromise(
        Effect.gen(function* demoteGrantee() {
          yield* addUser({ role: "admin", userId: "actor" });
          yield* addUser({ role: "admin", userId: "reader" });
          const sessionId = yield* addSession({ audience: "admin", userId: "actor" });
          yield* addOAuthGrant("reader");
          yield* setUserRole({ role: "user", sessionId, targetId: "reader" });
          return yield* oauthGrantCounts("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("are all revoked", ({ grantCounts }) => {
      expect(grantCounts).toStrictEqual({ access: 0, consent: 0, refresh: 0 });
    });
  });

  describe("of a user whose sessions were revoked", () => {
    const it = test.extend("grantCounts", async () =>
      Effect.runPromise(
        Effect.gen(function* revokeGrantee() {
          yield* addUser({ role: "admin", userId: "reader" });
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
    const it = test.extend("grantCounts", async () =>
      Effect.runPromise(
        Effect.gen(function* deleteGrantee() {
          yield* addUser({ role: "admin", userId: "actor" });
          yield* addUser({ userId: "reader" });
          const sessionId = yield* addSession({ audience: "admin", userId: "actor" });
          yield* addOAuthGrant("reader");
          yield* deleteUser(sessionId, "reader");
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
    const it = test.extend("revokedSession", async () =>
      Effect.runPromise(
        Effect.gen(function* revokeWiki() {
          yield* addUser({ role: "admin", userId: "reader" });
          const sessionId = yield* addSession({ audience: "wiki", userId: "reader" });
          yield* revokeUserSessions("reader");
          return yield* getSessionSecurity(sessionId, "wiki");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is no longer live", ({ revokedSession }) => {
      expect(revokedSession).toBe(null);
    });
  });
});
