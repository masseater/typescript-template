import { APPLICATION, ROLE } from "@repo/config";
import { Effect, type Layer } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { deleteUser, setUserRole } from "./admin.ts";
import { addOAuthGrant, addSession, addUser, oauthGrantCounts } from "./records-fixture.ts";
import { findWikiReader, getSessionSecurity, revokeUserSessions } from "./security.ts";
import { TestDatabase } from "./testing.ts";

const runTest = <Value>(
  program: Effect.Effect<Value, unknown, Layer.Success<typeof TestDatabase>>,
): Promise<Value> => Effect.runPromise(program.pipe(Effect.provide(TestDatabase)));

describe("findWikiReader", () => {
  describe("a verified administrator", () => {
    const it = test.extend("wikiReader", async () =>
      runTest(
        Effect.gen(function* findAdministrator() {
          yield* addUser({ role: ROLE.administrator, userId: "reader" });
          return yield* findWikiReader("reader");
        }),
      ));

    it("reads the wiki", ({ wikiReader }) => {
      expect(wikiReader).toStrictEqual({ id: "reader" });
    });
  });

  describe.for([
    ["a member", { userId: "member" }, "member"],
    [
      "an unverified administrator",
      { emailVerified: false, role: ROLE.administrator, userId: "unverified" },
      "unverified",
    ],
    ["a user who does not exist", undefined, "missing"],
  ] as const)("%s", ([, addedUser, readerId]) => {
    const it = test.extend("wikiReader", async () =>
      runTest(
        Effect.gen(function* findOther() {
          if (addedUser !== undefined) yield* addUser(addedUser);
          return yield* findWikiReader(readerId);
        }),
      ));

    it("does not read the wiki", ({ wikiReader }) => {
      expect(wikiReader).toBe(null);
    });
  });

  describe("an administrator demoted to member", () => {
    const it = test.extend("wikiReader", async () =>
      runTest(
        Effect.gen(function* demoteReader() {
          yield* addUser({ role: ROLE.administrator, userId: "actor" });
          yield* addUser({ role: ROLE.administrator, userId: "reader" });
          const sessionId = yield* addSession({
            audience: APPLICATION.admin,
            userId: "actor",
          });
          yield* setUserRole({ role: ROLE.member, sessionId, targetId: "reader" });
          return yield* findWikiReader("reader");
        }),
      ));

    it("stops reading the wiki", ({ wikiReader }) => {
      expect(wikiReader).toBe(null);
    });
  });
});

describe("OAuth grants", () => {
  describe("of an administrator demoted to member", () => {
    const it = test.extend("grantCounts", async () =>
      runTest(
        Effect.gen(function* demoteGrantee() {
          yield* addUser({ role: ROLE.administrator, userId: "actor" });
          yield* addUser({ role: ROLE.administrator, userId: "reader" });
          const sessionId = yield* addSession({
            audience: APPLICATION.admin,
            userId: "actor",
          });
          yield* addOAuthGrant("reader");
          yield* setUserRole({ role: ROLE.member, sessionId, targetId: "reader" });
          return yield* oauthGrantCounts("reader");
        }),
      ));

    it("are all revoked", ({ grantCounts }) => {
      expect(grantCounts).toStrictEqual({ access: 0, consent: 0, refresh: 0 });
    });
  });

  describe("of a user whose sessions were revoked", () => {
    const it = test.extend("grantCounts", async () =>
      runTest(
        Effect.gen(function* revokeGrantee() {
          yield* addUser({ role: ROLE.administrator, userId: "reader" });
          yield* addOAuthGrant("reader");
          yield* revokeUserSessions("reader");
          return yield* oauthGrantCounts("reader");
        }),
      ));

    it("lose their tokens but keep the consent", ({ grantCounts }) => {
      expect(grantCounts).toStrictEqual({ access: 0, consent: 1, refresh: 0 });
    });
  });

  describe("of a deleted user", () => {
    const it = test.extend("grantCounts", async () =>
      runTest(
        Effect.gen(function* deleteGrantee() {
          yield* addUser({ role: ROLE.administrator, userId: "actor" });
          yield* addUser({ userId: "reader" });
          const sessionId = yield* addSession({
            audience: APPLICATION.admin,
            userId: "actor",
          });
          yield* addOAuthGrant("reader");
          yield* deleteUser(sessionId, "reader");
          return yield* oauthGrantCounts("reader");
        }),
      ));

    it("are all removed", ({ grantCounts }) => {
      expect(grantCounts).toStrictEqual({ access: 0, consent: 0, refresh: 0 });
    });
  });
});

describe("revokeUserSessions", () => {
  describe("a wiki session of the revoked user", () => {
    const it = test.extend("revokedSession", async () =>
      runTest(
        Effect.gen(function* revokeWiki() {
          yield* addUser({ role: ROLE.administrator, userId: "reader" });
          const sessionId = yield* addSession({
            audience: APPLICATION.wiki,
            userId: "reader",
          });
          yield* revokeUserSessions("reader");
          return yield* getSessionSecurity(sessionId, APPLICATION.wiki);
        }),
      ));

    it("is no longer live", ({ revokedSession }) => {
      expect(revokedSession).toBe(null);
    });
  });
});
