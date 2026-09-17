import { maxLength, minLength, parse, pipe, strictObject, string, trim } from "valibot";
import { schema, user } from "./schema.ts";
import type { D1Database } from "@cloudflare/workers-types";
import type { DatabaseTrace } from "./database-trace.ts";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { instrumentD1 } from "./instrumentation.ts";

type Audience = "user" | "admin";
type Role = "user" | "admin";
type DatabaseBinding = D1Database;
type Database = DrizzleD1Database<typeof schema> & { $client: DatabaseBinding };
type Profile = Pick<typeof user.$inferSelect, "email" | "id" | "name" | "profile">;

function createDb(binding: DatabaseBinding, trace?: DatabaseTrace): Database {
  return drizzle(trace ? instrumentD1(binding, trace) : binding, { schema });
}

const NAME_MAX_LENGTH = 100;
const PROFILE_MAX_LENGTH = 2000;

const profileInput = strictObject({
  name: pipe(string(), trim(), minLength(1), maxLength(NAME_MAX_LENGTH)),
  profile: pipe(string(), maxLength(PROFILE_MAX_LENGTH)),
});

const profileColumns = {
  email: user.email,
  id: user.id,
  name: user.name,
  profile: user.profile,
};

async function getProfile(database: Database, userId: string): Promise<Profile | null> {
  const [profile] = await database
    .select(profileColumns)
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return profile ?? null;
}

async function updateProfile(database: Database, userId: string, input: unknown): Promise<Profile> {
  const values = parse(profileInput, input);
  const [profile] = await database
    .update(user)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning(profileColumns);
  if (!profile) {
    throw new Error("USER_NOT_FOUND");
  }
  return profile;
}

export { createDb, getProfile, updateProfile };
export { schema } from "./schema.ts";
export type { Audience, Database, DatabaseBinding, Role };
export type { DatabaseOperation, DatabaseTrace } from "./database-trace.ts";
