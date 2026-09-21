import { Email, ROLE } from "@repo/config";
import { sql, type SQL } from "drizzle-orm";
import { Clock, Effect, Schema, Struct } from "effect";

import { DatabaseFailure } from "./database-failure.ts";
import { query } from "./database.ts";
import { UserRow } from "./identity-schema.ts";
import { user } from "./schema.ts";

const BootstrappedAdmin = Schema.Struct({
  ...Struct.pick(UserRow.fields, ["email", "id"]),
  role: Schema.Literal(ROLE.administrator),
});

const bootstrapStatement = (email: typeof Email.Type, updatedAt: number): SQL => {
  return sql`UPDATE ${user}
    SET role = ${ROLE.administrator}, updated_at = ${updatedAt}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${ROLE.administrator})
    RETURNING id, email, role`;
};

const ensureAdminStatement = (email: typeof Email.Type, updatedAt: number): SQL => {
  return sql`UPDATE ${user}
    SET role = ${ROLE.administrator}, updated_at = ${updatedAt}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
    RETURNING id, email, role`;
};

class BootstrapUnavailable extends Schema.TaggedError<BootstrapUnavailable>()(
  "BootstrapUnavailable",
  {},
) {}

const bootstrapAdmin = Effect.fn("bootstrapAdmin")(function* bootstrapAdmin(
  email: typeof Email.Type,
) {
  const updatedAt = yield* Clock.currentTimeMillis;
  const [promotedRow] = yield* query((database) =>
    database.all(bootstrapStatement(email, updatedAt)),
  );
  if (promotedRow === undefined) {
    return yield* new BootstrapUnavailable();
  }
  return yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(promotedRow).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

const ensureAdminRole = Effect.fn("ensureAdminRole")(function* ensureAdminRole(
  email: typeof Email.Type,
) {
  const updatedAt = yield* Clock.currentTimeMillis;
  const [updated] = yield* query((database) =>
    database.all(ensureAdminStatement(email, updatedAt)),
  );
  if (updated === undefined) {
    return yield* new BootstrapUnavailable();
  }
  return yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(updated).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

export { BootstrappedAdmin, Email, bootstrapAdmin, bootstrapStatement, ensureAdminRole };
