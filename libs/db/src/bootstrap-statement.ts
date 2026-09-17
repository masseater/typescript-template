import { email, pipe, safeParse, string } from "valibot";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { user } from "./schema.ts";

const emailSchema = pipe(string(), email());

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

export { bootstrapStatement };
