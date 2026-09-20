import { Email, ROLE } from "@repo/config";
import { sql, type SQL } from "drizzle-orm";
import { Effect, Schema, Struct } from "effect";

import { DatabaseFailure } from "./database-failure.ts";
import { query } from "./database.ts";
import { UserRow } from "./identity-schema.ts";
import { user } from "./schema.ts";

const AssignedAccount = Schema.Struct({
  ...Struct.pick(UserRow.fields, ["email", "id"]),
  role: Schema.Literals([ROLE.administrator, ROLE.staff]),
});

const bootstrapStatement = (email: typeof Email.Type): SQL => {
  return sql`UPDATE ${user}
    SET role = ${ROLE.administrator}, permission = ${"manage"}, account_state = ${"active"}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${ROLE.administrator})
    RETURNING id, email, role`;
};

const ensureAdminStatement = (email: typeof Email.Type): SQL => {
  return sql`UPDATE ${user}
    SET role = ${ROLE.administrator}, permission = ${"manage"}, account_state = ${"active"}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
    RETURNING id, email, role`;
};

const assignStaffStatement = (email: typeof Email.Type): SQL => {
  return sql`UPDATE ${user}
    SET role = ${ROLE.staff}, permission = ${"edit"}, account_state = ${"active"}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND ${user.role} = ${ROLE.member}
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
  return yield* Schema.decodeUnknownEffect(AssignedAccount)(promotedRow).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

const ensureAdminRole = Effect.fn("ensureAdminRole")(function* ensureAdminRole(
  email: typeof Email.Type,
) {
  const [updated] = yield* query(async (database) => database.all(ensureAdminStatement(email)));
  if (updated === undefined) {
    return yield* new BootstrapUnavailable();
  }
  return yield* Schema.decodeUnknownEffect(AssignedAccount)(updated).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

const assignStaff = Effect.fn("assignStaff")(function* assignStaff(email: typeof Email.Type) {
  const [assigned] = yield* query(async (database) => database.all(assignStaffStatement(email)));
  if (assigned === undefined) {
    return yield* new BootstrapUnavailable();
  }
  return yield* Schema.decodeUnknownEffect(AssignedAccount)(assigned).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

const BootstrappedAdmin = AssignedAccount;

export {
  BootstrappedAdmin,
  Email,
  assignStaff,
  bootstrapAdmin,
  bootstrapStatement,
  ensureAdminRole,
};
