import { Email, ROLE } from "@repo/config";
import { sql, type SQL } from "drizzle-orm";
import { Effect, Schema, Struct } from "effect";

import { DatabaseFailure } from "./database-failure.ts";
import { query } from "./database.ts";
import { UserRow } from "./identity-schema.ts";
import { user } from "./schema.ts";

const BootstrappedAdmin = Schema.Struct({
  ...Struct.pick(UserRow.fields, ["email", "id"]),
  role: Schema.Literal(ROLE.administrator),
});

const bootstrapStatement = (email: typeof Email.Type): SQL => {
  return sql`UPDATE ${user}
    SET role = ${ROLE.administrator}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${ROLE.administrator})
    RETURNING id, email, role`;
};

const ensureAdminStatement = (email: typeof Email.Type): SQL => {
  return sql`UPDATE ${user}
    SET role = ${ROLE.administrator}, updated_at = ${Date.now()}
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
  const [promotedRow] = yield* query(async (database) => database.all(bootstrapStatement(email)));
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
  const [promotedAdministrator] = yield* query(async (database) =>
    database.all(ensureAdminStatement(email)),
  );
  if (promotedAdministrator === undefined) {
    return yield* new BootstrapUnavailable();
  }
  return yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(promotedAdministrator).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

export {
  BootstrappedAdmin,
  BootstrapUnavailable,
  Email,
  bootstrapAdmin,
  bootstrapStatement,
  ensureAdminRole,
};
