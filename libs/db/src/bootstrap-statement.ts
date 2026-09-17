import { sql } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { Effect, Schema } from "effect";
import { user } from "./schema.ts";

export const EmailAddress = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));

class BootstrapStatementInvalid extends Schema.TaggedError<BootstrapStatementInvalid>()(
  "BootstrapStatementInvalid",
  {},
) {}

export function bootstrapStatement(email: typeof EmailAddress.Type) {
  return sql`UPDATE ${user}
    SET role = ${"admin"}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${"admin"})
    RETURNING id, email, role`;
}

const Params = Schema.Array(Schema.Union([Schema.String, Schema.Finite, Schema.Null]));

export const compileBootstrapStatement = Effect.fn("compileBootstrapStatement")(function* (
  email: typeof EmailAddress.Type,
) {
  const query = new SQLiteAsyncDialect().sqlToQuery(bootstrapStatement(email));
  const params = yield* Schema.decodeUnknownEffect(Params)(query.params).pipe(
    Effect.mapError(() => new BootstrapStatementInvalid()),
  );
  return { sql: query.sql, params };
});
