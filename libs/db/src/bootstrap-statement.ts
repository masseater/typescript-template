import { sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { query } from "./index.ts";
import type { Role } from "@template/config";
import { user } from "./schema.ts";

export const EmailAddress = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));

export function bootstrapStatement(email: typeof EmailAddress.Type) {
  return sql`UPDATE ${user}
    SET role = ${"admin"}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${"admin"})
    RETURNING id, email, role`;
}

class BootstrapUnavailable extends Schema.TaggedError<BootstrapUnavailable>()(
  "BootstrapUnavailable",
  {},
) {}

export const bootstrapAdmin = Effect.fn("bootstrapAdmin")(function* (
  email: typeof EmailAddress.Type,
) {
  const [updated] = yield* query((database) =>
    database.all<{ id: string; email: string; role: Role }>(bootstrapStatement(email)),
  );
  if (!updated) return yield* new BootstrapUnavailable();
  return updated;
});
