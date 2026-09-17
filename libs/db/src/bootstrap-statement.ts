import { Effect, Schema, Struct } from "effect";
import type { SQL } from "drizzle-orm";
import { UserRow } from "./row-schema.ts";
import { query } from "./database.ts";
import { sql } from "drizzle-orm";
import { user } from "./schema.ts";

const EmailAddress = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u));

const BootstrappedAdmin = Schema.Struct({
  ...Struct.pick(UserRow.fields, ["email", "id"]),
  role: Schema.Literal("admin"),
});

function bootstrapStatement(email: typeof EmailAddress.Type): SQL {
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

const bootstrapAdmin = Effect.fn("bootstrapAdmin")(function* bootstrapAdmin(
  email: typeof EmailAddress.Type,
) {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  const [updated] = yield* query((database) =>
    database.all<typeof BootstrappedAdmin.Type>(bootstrapStatement(email)),
  );
  if (!updated) {
    return yield* new BootstrapUnavailable();
  }
  return updated;
});

export { BootstrappedAdmin, EmailAddress, bootstrapAdmin, bootstrapStatement };
