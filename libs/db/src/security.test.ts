import { eq } from "drizzle-orm";
import { expect, test as baseTest } from "vitest";
import { bootstrapAdmin, deleteUser, listUsers, setUserRole } from "./admin.ts";
import { getProfile, updateProfile } from "./index.ts";
import type { Audience, Database, Role } from "./index.ts";
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
import { createTestDatabase } from "./testing.ts";

const test = baseTest.extend<{ db: Database }>({
  db: async ({}, provide) => {
    const resource = await createTestDatabase();
    try {
      await provide(resource.database);
    } finally {
      await resource.dispose();
    }
  },
});

async function addUser(db: Database, id: string, role: Role = "user") {
  await db.insert(user).values({
    id,
    name: id,
    email: `${id}@example.com`,
    role,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function addSession(db: Database, userId: string, audience: Audience, strong = true) {
  const id = crypto.randomUUID();
  const [owner] = await db.select().from(user).where(eq(user.id, userId));
  if (!owner) throw new Error("USER_REQUIRED");
  await db.insert(session).values({
    id,
    token: crypto.randomUUID(),
    userId,
    audience,
    securityVersion: owner.securityVersion,
    authenticationMethod: strong ? "password_totp" : "password",
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  });
  return id;
}

test("persists Unicode profile and rejects attempts to update role", async ({ db }) => {
  await addUser(db, "reader");
  await updateProfile(db, "reader", { name: "日本語 العربية 🐈", profile: "私は開発者です。" });
  expect(await getProfile(db, "reader")).toMatchObject({
    name: "日本語 العربية 🐈",
    profile: "私は開発者です。",
  });
  await expect(
    updateProfile(db, "reader", { name: "reader", profile: "", role: "admin" }),
  ).rejects.toThrow("Invalid key");
});

test("rejects weak admin and cross-audience sessions", async ({ db }) => {
  await addUser(db, "administrator", "admin");
  const weak = await addSession(db, "administrator", "admin", false);
  const wrongAudience = await addSession(db, "administrator", "user");
  await expect(listUsers(db, weak)).rejects.toThrow("ADMIN_STRONG_SESSION_REQUIRED");
  await expect(listUsers(db, wrongAudience)).rejects.toThrow("ADMIN_STRONG_SESSION_REQUIRED");
  const strong = await addSession(db, "administrator", "admin");
  expect((await listUsers(db, strong)).users).toHaveLength(1);
});

test("role change invalidates both audiences immediately", async ({ db }) => {
  await addUser(db, "actor", "admin");
  await addUser(db, "target", "admin");
  const actor = await addSession(db, "actor", "admin");
  const targetAdmin = await addSession(db, "target", "admin");
  const targetUser = await addSession(db, "target", "user");
  await setUserRole(db, actor, "target", "user");
  expect(await getSessionSecurity(db, targetAdmin, "admin")).toBeNull();
  expect(await getSessionSecurity(db, targetUser, "user")).toBeNull();
});

async function addOAuthGrant(db: Database, userId: string) {
  const clientId = `client-${userId}`;
  await db.insert(oauthClient).values({ id: clientId, clientId, redirectUris: "[]" });
  await db.insert(oauthRefreshToken).values({
    id: `refresh-${userId}`,
    token: `refresh-token-${userId}`,
    clientId,
    userId,
    scopes: '["wiki:read"]',
  });
  await db.insert(oauthAccessToken).values({
    id: `access-${userId}`,
    token: `access-token-${userId}`,
    clientId,
    userId,
    refreshId: `refresh-${userId}`,
    scopes: '["wiki:read"]',
  });
  await db.insert(oauthConsent).values({
    id: `consent-${userId}`,
    clientId,
    userId,
    scopes: '["wiki:read"]',
  });
}

async function oauthGrantCounts(db: Database, userId: string) {
  return {
    access: (await db.select().from(oauthAccessToken).where(eq(oauthAccessToken.userId, userId)))
      .length,
    refresh: (await db.select().from(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId)))
      .length,
    consent: (await db.select().from(oauthConsent).where(eq(oauthConsent.userId, userId))).length,
  };
}

test("role change revokes wiki reading and every OAuth grant of the user", async ({ db }) => {
  await addUser(db, "actor", "admin");
  await addUser(db, "reader", "admin");
  const actor = await addSession(db, "actor", "admin");
  await addOAuthGrant(db, "reader");
  expect(await findWikiReader(db, "reader")).toEqual({ id: "reader" });
  await setUserRole(db, actor, "reader", "user");
  expect(await findWikiReader(db, "reader")).toBeNull();
  expect(await oauthGrantCounts(db, "reader")).toEqual({ access: 0, refresh: 0, consent: 0 });
});

test("revoking sessions also revokes OAuth tokens but keeps consent", async ({ db }) => {
  await addUser(db, "reader", "admin");
  const wiki = await addSession(db, "reader", "wiki");
  await addOAuthGrant(db, "reader");
  await revokeUserSessions(db, "reader");
  expect(await getSessionSecurity(db, wiki, "wiki")).toBeNull();
  expect(await oauthGrantCounts(db, "reader")).toEqual({ access: 0, refresh: 0, consent: 1 });
});

test("deleting a user removes OAuth grants", async ({ db }) => {
  await addUser(db, "actor", "admin");
  await addUser(db, "reader");
  const actor = await addSession(db, "actor", "admin");
  await addOAuthGrant(db, "reader");
  await deleteUser(db, actor, "reader");
  expect(await oauthGrantCounts(db, "reader")).toEqual({ access: 0, refresh: 0, consent: 0 });
});

test("wiki reading requires a verified administrator", async ({ db }) => {
  await addUser(db, "member");
  await db.insert(user).values({
    id: "unverified",
    name: "unverified",
    email: "unverified@example.com",
    role: "admin",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  expect(await findWikiReader(db, "member")).toBeNull();
  expect(await findWikiReader(db, "unverified")).toBeNull();
  expect(await findWikiReader(db, "missing")).toBeNull();
});

test("protects final administrator and credentials during deletion", async ({ db }) => {
  await addUser(db, "last", "admin");
  await db.insert(account).values({
    id: "credential",
    accountId: "last",
    providerId: "credential",
    userId: "last",
    password: "not-used-for-authentication-in-db-test",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const actor = await addSession(db, "last", "admin");
  await expect(deleteUser(db, actor, "last")).rejects.toThrow("LAST_ADMIN_REQUIRED");
  await expect(setUserRole(db, actor, "last", "user")).rejects.toThrow("LAST_ADMIN_REQUIRED");
  expect(await db.select().from(account)).toHaveLength(1);
  expect((await getSessionSecurity(db, actor, "admin"))?.user.role).toBe("admin");
});

test("simultaneous self-demotions cannot remove all administrators", async ({ db }) => {
  await addUser(db, "a", "admin");
  await addUser(db, "b", "admin");
  const a = await addSession(db, "a", "admin");
  const b = await addSession(db, "b", "admin");
  const outcomes = await Promise.allSettled([
    setUserRole(db, a, "a", "user"),
    setUserRole(db, b, "b", "user"),
  ]);
  expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(await db.select().from(user).where(eq(user.role, "admin"))).toHaveLength(1);
});

test("deletion removes credentials and all sessions", async ({ db }) => {
  await addUser(db, "actor", "admin");
  await addUser(db, "target");
  const actor = await addSession(db, "actor", "admin");
  const target = await addSession(db, "target", "user");
  await deleteUser(db, actor, "target");
  expect(await getProfile(db, "target")).toBeNull();
  expect(await getSessionSecurity(db, target, "user")).toBeNull();
});

test("first administrator bootstrap is atomic and one-time", async ({ db }) => {
  await addUser(db, "a");
  await addUser(db, "b");
  const outcomes = await Promise.allSettled([
    bootstrapAdmin(db, "a@example.com"),
    bootstrapAdmin(db, "b@example.com"),
  ]);
  expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
});
