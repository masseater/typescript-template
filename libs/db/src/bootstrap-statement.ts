import { Effect, Schema } from "effect";
import type { Role } from "@template/config";
import type { SQL } from "drizzle-orm";
import { query } from "./database.ts";
import { sql } from "drizzle-orm";
import { user } from "./schema.ts";

const EmailAddress = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u));

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
    database.all<{ id: string; email: string; role: Role }>(bootstrapStatement(email)),
  );
  if (!updated) {
    return yield* new BootstrapUnavailable();
  }
  return updated;
});

export { EmailAddress, bootstrapAdmin, bootstrapStatement };
