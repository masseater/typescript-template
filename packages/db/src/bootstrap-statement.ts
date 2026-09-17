import { sql } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import * as v from "valibot";
import { user } from "./schema.ts";

export function bootstrapStatement(email: string) {
  const address = v.safeParse(v.pipe(v.string(), v.email()), email);
  if (!address.success) throw new Error("BOOTSTRAP_EMAIL_INVALID");
  return sql`UPDATE ${user}
    SET role = ${"admin"}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${address.output.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${"admin"})
    RETURNING id, email, role`;
}

export function compileBootstrapStatement(email: string) {
  const query = new SQLiteAsyncDialect().sqlToQuery(bootstrapStatement(email));
  const params = v.parse(v.array(v.union([v.string(), v.number(), v.null()])), query.params);
  return { sql: query.sql, params };
}
