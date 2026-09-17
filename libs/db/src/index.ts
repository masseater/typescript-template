import type { D1Database } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as v from "valibot";
import { instrumentD1 } from "./instrumentation.ts";
import type { DatabaseTrace } from "./instrumentation.ts";
import { schema, user } from "./schema.ts";

export { schema } from "./schema.ts";
export type { DatabaseOperation, DatabaseTrace } from "./instrumentation.ts";
export type Audience = "user" | "admin" | "wiki";
export type Role = "user" | "admin";
export type DatabaseBinding = D1Database;

export function createDb(binding: DatabaseBinding, trace?: DatabaseTrace) {
  return drizzle(trace ? instrumentD1(binding, trace) : binding, { schema });
}

export type Database = ReturnType<typeof createDb>;

const profileInput = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
  profile: v.pipe(v.string(), v.maxLength(2000)),
});

export async function getProfile(database: Database, userId: string) {
  const [profile] = await database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      profile: user.profile,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return profile ?? null;
}

export async function updateProfile(database: Database, userId: string, input: unknown) {
  const values = v.parse(profileInput, input);
  const [profile] = await database
    .update(user)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      profile: user.profile,
    });
  if (!profile) throw new Error("USER_NOT_FOUND");
  return profile;
}
