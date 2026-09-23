import { APPLICATION, ROLE } from "@repo/config";
import { AUTHENTICATION_METHOD } from "@repo/config/identity";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { deleteUser, setUserRole } from "./admin.ts";
import { query } from "./database.ts";
import {
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
  user,
} from "./schema.ts";
import { findWikiReader, getSessionSecurity, revokeUserSessions } from "./security.ts";
import { TestDatabase } from "./testing.ts";

const recordedAt = new Date("2026-01-01T00:00:00.000Z");
const SESSION_LIFETIME_MS = 60_000;

describe("findWikiReader", () => {
  describe("a verified administrator", () => {
    const it = test.extend("wikiReader", async () =>
      Effect.runPromise(
        Effect.gen(function* findAdministrator() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values({
              createdAt: recordedAt,
              email: "reader@example.com",
              emailVerified: true,
              id: "reader",
              name: "reader",
              role: ROLE.administrator,
              updatedAt: recordedAt,
            });
          });
          return yield* findWikiReader("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("reads the wiki", ({ wikiReader }) => {
      expect(wikiReader).toStrictEqual({ id: "reader" });
    });
  });

  describe("a member", () => {
    const it = test.extend("wikiReader", async () =>
      Effect.runPromise(
        Effect.gen(function* findMember() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values({
              createdAt: recordedAt,
              email: "member@example.com",
              emailVerified: true,
              id: "member",
              name: "member",
              role: ROLE.member,
              updatedAt: recordedAt,
            });
          });
          return yield* findWikiReader("member");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("does not read the wiki", ({ wikiReader }) => {
      expect(wikiReader).toBe(undefined);
    });
  });

  describe("an administrator demoted to member", () => {
    const it = test.extend("wikiReader", async () =>
      Effect.runPromise(
        Effect.gen(function* demoteReader() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values({
              createdAt: recordedAt,
              email: "actor@example.com",
              emailVerified: true,
              id: "actor",
              name: "actor",
              role: ROLE.administrator,
              updatedAt: recordedAt,
            });
          });
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values({
              createdAt: recordedAt,
              email: "reader@example.com",
              emailVerified: true,
              id: "reader",
              name: "reader",
              role: ROLE.administrator,
              updatedAt: recordedAt,
            });
          });
          const sessionId = crypto.randomUUID();
          yield* query(async (database): Promise<void> => {
            await database.insert(session).values({
              audience: APPLICATION.admin,
              authenticationMethod: AUTHENTICATION_METHOD.passwordTotp,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
              id: sessionId,
              securityVersion: 0,
              token: crypto.randomUUID(),
              updatedAt: new Date(),
              userId: "actor",
            });
          });
          yield* setUserRole({ role: ROLE.member, sessionId, targetId: "reader" });
          return yield* findWikiReader("reader");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("stops reading the wiki", ({ wikiReader }) => {
      expect(wikiReader).toBe(undefined);
    });
  });
});

describe("revokeUserSessions", () => {
  describe("a wiki session of the revoked user", () => {
    const it = test.extend("revokedSession", async () =>
      Effect.runPromise(
        Effect.gen(function* revokeWiki() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values({
              createdAt: recordedAt,
              email: "reader@example.com",
              emailVerified: true,
              id: "reader",
              name: "reader",
              role: ROLE.administrator,
              updatedAt: recordedAt,
            });
          });
          const sessionId = crypto.randomUUID();
          yield* query(async (database): Promise<void> => {
            await database.insert(session).values({
              audience: APPLICATION.wiki,
              authenticationMethod: AUTHENTICATION_METHOD.passwordTotp,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
              id: sessionId,
              securityVersion: 0,
              token: crypto.randomUUID(),
              updatedAt: new Date(),
              userId: "reader",
            });
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

describe("OAuth grants of a deleted user", () => {
  const it = test.extend("grantCounts", async () =>
    Effect.runPromise(
      Effect.gen(function* deleteGrantee() {
        yield* query(async (database): Promise<void> => {
          await database.insert(user).values({
            createdAt: recordedAt,
            email: "actor@example.com",
            emailVerified: true,
            id: "actor",
            name: "actor",
            role: ROLE.administrator,
            updatedAt: recordedAt,
          });
        });
        yield* query(async (database): Promise<void> => {
          await database.insert(user).values({
            createdAt: recordedAt,
            email: "reader@example.com",
            emailVerified: true,
            id: "reader",
            name: "reader",
            role: ROLE.member,
            updatedAt: recordedAt,
          });
        });
        const sessionId = crypto.randomUUID();
        yield* query(async (database): Promise<void> => {
          await database.insert(session).values({
            audience: APPLICATION.admin,
            authenticationMethod: AUTHENTICATION_METHOD.passwordTotp,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
            id: sessionId,
            securityVersion: 0,
            token: crypto.randomUUID(),
            updatedAt: new Date(),
            userId: "actor",
          });
        });
        const clientId = "client-reader";
        const scopes = '["wiki:read"]';
        yield* query(async (database): Promise<void> => {
          await database.batch([
            database.insert(oauthClient).values({ clientId, id: clientId, redirectUris: "[]" }),
            database.insert(oauthRefreshToken).values({
              clientId,
              id: "refresh-reader",
              scopes,
              token: "refresh-token-reader",
              userId: "reader",
            }),
            database.insert(oauthAccessToken).values({
              clientId,
              id: "access-reader",
              refreshId: "refresh-reader",
              scopes,
              token: "access-token-reader",
              userId: "reader",
            }),
            database
              .insert(oauthConsent)
              .values({ clientId, id: "consent-reader", scopes, userId: "reader" }),
          ]);
        });
        yield* deleteUser(sessionId, "reader");
        const access = yield* query(async (database) =>
          database.select().from(oauthAccessToken).where(eq(oauthAccessToken.userId, "reader")),
        );
        const refresh = yield* query(async (database) =>
          database.select().from(oauthRefreshToken).where(eq(oauthRefreshToken.userId, "reader")),
        );
        const consent = yield* query(async (database) =>
          database.select().from(oauthConsent).where(eq(oauthConsent.userId, "reader")),
        );
        return { access: access.length, consent: consent.length, refresh: refresh.length };
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("are all removed", ({ grantCounts }) => {
    expect(grantCounts).toStrictEqual({ access: 0, consent: 0, refresh: 0 });
  });
});
