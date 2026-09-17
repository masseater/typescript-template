import { array, email, null_, number, parse, pipe, safeParse, string, union } from "valibot";
import type { SQL } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { user } from "./schema.ts";

interface BootstrapQuery {
  params: (string | number | null)[];
  sql: string;
}

const emailSchema = pipe(string(), email());
const paramsSchema = array(union([string(), number(), null_()]));

function bootstrapStatement(address: string): SQL {
  const parsed = safeParse(emailSchema, address);
  if (!parsed.success) {
    throw new Error("BOOTSTRAP_EMAIL_INVALID");
  }
  return sql`UPDATE ${user}
    SET role = ${"admin"}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${parsed.output.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${"admin"})
    RETURNING id, email, role`;
}

function compileBootstrapStatement(address: string): BootstrapQuery {
  const query = new SQLiteAsyncDialect().sqlToQuery(bootstrapStatement(address));
  return { params: parse(paramsSchema, query.params), sql: query.sql };
}

export { bootstrapStatement, compileBootstrapStatement };
