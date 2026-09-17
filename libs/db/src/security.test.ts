import type { Application, Role } from "@template/config";
import {
  account,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
  user,
} from "./schema.ts";
import { test as baseTest, expect } from "vite-plus/test";
import { bootstrapAdmin, deleteUser, listUsers, setUserRole } from "./admin.ts";
import { findWikiReader, getSessionSecurity, revokeUserSessions } from "./security.ts";
import { getProfile, updateProfile } from "./index.ts";
import type { Database } from "./index.ts";
import { createTestDatabase } from "./testing.ts";
import { eq } from "drizzle-orm";

const SESSION_LIFETIME_MS = 60_000;

type SessionRequest = Readonly<{ audience: Application; strong?: boolean; userId: string }>;
type TestDatabase = Readonly<Pick<Database, "all" | "delete" | "insert" | "select" | "update">>;
type Context = Readonly<{ db: TestDatabase }>;

const test = baseTest.extend<Context>({
  db: async ({}: Readonly<object>, provide) => {
    const resource = await createTestDatabase();
    try {
      await provide(resource.database);
    } finally {
      await resource.dispose();
    }
  },
});

async function addUser(db: TestDatabase, id: string, role: Role = "user"): Promise<void> {
  await db.insert(user).values({
    createdAt: new Date(),
    email: `${id}@example.com`,
    emailVerified: true,
    id,
    name: id,
    role,
    updatedAt: new Date(),
  });
}

async function addSession(
  db: TestDatabase,
  { audience, strong = true, userId }: SessionRequest,
): Promise<string> {
  const id = crypto.randomUUID();
  const [owner] = await db.select().from(user).where(eq(user.id, userId));
  if (!owner) {
    throw new Error("USER_REQUIRED");
  }
  await db.insert(session).values({
    audience,
    authenticationMethod: strong ? "password_totp" : "password",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
    id,
    securityVersion: owner.securityVersion,
    token: crypto.randomUUID(),
    updatedAt: new Date(),
    userId,
  });
  return id;
}

test("persists Unicode profile and rejects attempts to update role", async ({ db }: Context) => {
  await addUser(db, "reader");
  await updateProfile(db, "reader", { name: "日本語 العربية 🐈", profile: "私は開発者です。" });
  await expect(getProfile(db, "reader")).resolves.toMatchObject({
    name: "日本語 العربية 🐈",
    profile: "私は開発者です。",
  });
  await expect(
    updateProfile(db, "reader", { name: "reader", profile: "", role: "admin" }),
  ).rejects.toThrow("Invalid key");
});

test("rejects weak admin and cross-audience sessions", async ({ db }: Context) => {
  await addUser(db, "administrator", "admin");
  const weak = await addSession(db, { audience: "admin", strong: false, userId: "administrator" });
  const wrongAudience = await addSession(db, { audience: "user", userId: "administrator" });
  await expect(listUsers(db, weak)).rejects.toThrow("ADMIN_STRONG_SESSION_REQUIRED");
  await expect(listUsers(db, wrongAudience)).rejects.toThrow("ADMIN_STRONG_SESSION_REQUIRED");
  const strong = await addSession(db, { audience: "admin", userId: "administrator" });
  await expect(listUsers(db, strong)).resolves.toMatchObject({ users: [{ id: "administrator" }] });
});

test("role change invalidates both audiences immediately", async ({ db }: Context) => {
  await addUser(db, "actor", "admin");
  await addUser(db, "target", "admin");
  const actor = await addSession(db, { audience: "admin", userId: "actor" });
  const targetAdmin = await addSession(db, { audience: "admin", userId: "target" });
  const targetUser = await addSession(db, { audience: "user", userId: "target" });
  await setUserRole({ database: db, role: "user", sessionId: actor, targetId: "target" });
  await expect(getSessionSecurity(db, targetAdmin, "admin")).resolves.toBeUndefined();
  await expect(getSessionSecurity(db, targetUser, "user")).resolves.toBeUndefined();
});

async function addOAuthGrant(db: TestDatabase, userId: string): Promise<void> {
  const clientId = `client-${userId}`;
  const scopes = '["wiki:read"]';
  await db.insert(oauthClient).values({ clientId, id: clientId, redirectUris: "[]" });
  await db.insert(oauthRefreshToken).values({
    clientId,
    id: `refresh-${userId}`,
    scopes,
    token: `refresh-token-${userId}`,
    userId,
  });
  await db.insert(oauthAccessToken).values({
    clientId,
    id: `access-${userId}`,
    refreshId: `refresh-${userId}`,
    scopes,
    token: `access-token-${userId}`,
    userId,
  });
  await db.insert(oauthConsent).values({ clientId, id: `consent-${userId}`, scopes, userId });
}

async function oauthGrantCounts(
  db: TestDatabase,
  userId: string,
): Promise<Record<"access" | "consent" | "refresh", number>> {
  const [access, refresh, consent] = await Promise.all([
    db.select().from(oauthAccessToken).where(eq(oauthAccessToken.userId, userId)),
    db.select().from(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId)),
    db.select().from(oauthConsent).where(eq(oauthConsent.userId, userId)),
  ]);
  return { access: access.length, consent: consent.length, refresh: refresh.length };
}

test("role change revokes wiki reading and every OAuth grant of the user", async ({
  db,
}: Context) => {
  await addUser(db, "actor", "admin");
  await addUser(db, "reader", "admin");
  const actor = await addSession(db, { audience: "admin", userId: "actor" });
  await addOAuthGrant(db, "reader");
  await expect(findWikiReader(db, "reader")).resolves.toStrictEqual({ id: "reader" });
  await setUserRole({ database: db, role: "user", sessionId: actor, targetId: "reader" });
  await expect(findWikiReader(db, "reader")).resolves.toBeUndefined();
  await expect(oauthGrantCounts(db, "reader")).resolves.toStrictEqual({
    access: 0,
    consent: 0,
    refresh: 0,
  });
});

test("revoking sessions also revokes OAuth tokens but keeps consent", async ({ db }: Context) => {
  await addUser(db, "reader", "admin");
  const wiki = await addSession(db, { audience: "wiki", userId: "reader" });
  await addOAuthGrant(db, "reader");
  await revokeUserSessions(db, "reader");
  await expect(getSessionSecurity(db, wiki, "wiki")).resolves.toBeUndefined();
  await expect(oauthGrantCounts(db, "reader")).resolves.toStrictEqual({
    access: 0,
    consent: 1,
    refresh: 0,
  });
});

test("deleting a user removes OAuth grants", async ({ db }: Context) => {
  await addUser(db, "actor", "admin");
  await addUser(db, "reader");
  const actor = await addSession(db, { audience: "admin", userId: "actor" });
  await addOAuthGrant(db, "reader");
  await deleteUser(db, actor, "reader");
  await expect(oauthGrantCounts(db, "reader")).resolves.toStrictEqual({
    access: 0,
    consent: 0,
    refresh: 0,
  });
});

test("wiki reading requires a verified administrator", async ({ db }: Context) => {
  await addUser(db, "member");
  await db.insert(user).values({
    createdAt: new Date(),
    email: "unverified@example.com",
    emailVerified: false,
    id: "unverified",
    name: "unverified",
    role: "admin",
    updatedAt: new Date(),
  });
  await expect(findWikiReader(db, "member")).resolves.toBeUndefined();
  await expect(findWikiReader(db, "unverified")).resolves.toBeUndefined();
  await expect(findWikiReader(db, "missing")).resolves.toBeUndefined();
});

test("protects final administrator and credentials during deletion", async ({ db }: Context) => {
  await addUser(db, "last", "admin");
  await db.insert(account).values({
    accountId: "last",
    createdAt: new Date(),
    id: "credential",
    password: "not-used-for-authentication-in-db-test",
    providerId: "credential",
    updatedAt: new Date(),
    userId: "last",
  });
  const actor = await addSession(db, { audience: "admin", userId: "last" });
  await expect(deleteUser(db, actor, "last")).rejects.toThrow("LAST_ADMIN_REQUIRED");
  await expect(
    setUserRole({ database: db, role: "user", sessionId: actor, targetId: "last" }),
  ).rejects.toThrow("LAST_ADMIN_REQUIRED");
  await expect(db.select().from(account)).resolves.toHaveLength(1);
  await expect(getSessionSecurity(db, actor, "admin")).resolves.toMatchObject({
    user: { role: "admin" },
  });
});

test("simultaneous self-demotions cannot remove all administrators", async ({ db }: Context) => {
  await addUser(db, "alpha", "admin");
  await addUser(db, "beta", "admin");
  const alpha = await addSession(db, { audience: "admin", userId: "alpha" });
  const beta = await addSession(db, { audience: "admin", userId: "beta" });
  const outcomes = await Promise.allSettled([
    setUserRole({ database: db, role: "user", sessionId: alpha, targetId: "alpha" }),
    setUserRole({ database: db, role: "user", sessionId: beta, targetId: "beta" }),
  ]);
  expect(
    outcomes.filter((result: Readonly<{ status: string }>) => result.status === "fulfilled"),
  ).toHaveLength(1);
  await expect(db.select().from(user).where(eq(user.role, "admin"))).resolves.toHaveLength(1);
});

test("deletion removes credentials and all sessions", async ({ db }: Context) => {
  await addUser(db, "actor", "admin");
  await addUser(db, "target");
  const actor = await addSession(db, { audience: "admin", userId: "actor" });
  const target = await addSession(db, { audience: "user", userId: "target" });
  await deleteUser(db, actor, "target");
  await expect(getProfile(db, "target")).resolves.toBeNull();
  await expect(getSessionSecurity(db, target, "user")).resolves.toBeUndefined();
});

test("first administrator bootstrap is atomic and one-time", async ({ db }: Context) => {
  await addUser(db, "alpha");
  await addUser(db, "beta");
  const outcomes = await Promise.allSettled([
    bootstrapAdmin(db, "alpha@example.com"),
    bootstrapAdmin(db, "beta@example.com"),
  ]);
  expect(
    outcomes.filter((result: Readonly<{ status: string }>) => result.status === "fulfilled"),
  ).toHaveLength(1);
});
