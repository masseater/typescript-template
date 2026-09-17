import { maxLength, minLength, parse, pipe, strictObject, string, trim } from "valibot";
import { schema, user } from "./schema.ts";
import type { D1Database } from "@cloudflare/workers-types";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";

type DatabaseBinding = D1Database;
type Database = DrizzleD1Database<typeof schema> & { $client: DatabaseBinding };
type Profile = Pick<typeof user.$inferSelect, "email" | "id" | "name" | "profile">;

function createDb(binding: Readonly<DatabaseBinding>): Database {
  return drizzle(binding, { schema });
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

async function checkDatabase(database: Readonly<Pick<Database, "select">>): Promise<void> {
  await database.select({ id: user.id }).from(user).limit(1);
}

async function getProfile(
  database: Readonly<Pick<Database, "select">>,
  userId: string,
): Promise<Profile | null> {
  const [profile] = await database
    .select(profileColumns)
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  // oxlint-disable-next-line unicorn/no-null
  return profile ?? null;
}

async function updateProfile(
  database: Readonly<Pick<Database, "update">>,
  userId: string,
  input: unknown,
): Promise<Profile> {
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

export { checkDatabase, createDb, getProfile, updateProfile };
export { schema } from "./schema.ts";
export type { Database, DatabaseBinding };
