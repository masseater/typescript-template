import { sql } from "drizzle-orm";
import { Effect, Schema, Struct } from "effect";

import { DatabaseFailure } from "./database-failure.ts";
import { query } from "./database.ts";
import { UserRow } from "./identity-schema.ts";
import { user } from "./schema.ts";

import type { SQL } from "drizzle-orm";

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

function ensureAdminStatement(email: typeof EmailAddress.Type): SQL {
  return sql`UPDATE ${user}
    SET role = ${"admin"}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
    RETURNING id, email, role`;
}

class BootstrapUnavailable extends Schema.TaggedError<BootstrapUnavailable>()(
  "BootstrapUnavailable",
  {},
) {}

const bootstrapAdmin = Effect.fn("bootstrapAdmin")(function* bootstrapAdmin(
  email: typeof EmailAddress.Type,
) {
  const [updated] = yield* query(async (database) => database.all(bootstrapStatement(email)));
  if (updated === undefined) {
    return yield* new BootstrapUnavailable();
  }
  return yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(updated).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

const ensureAdminRole = Effect.fn("ensureAdminRole")(function* ensureAdminRole(
  email: typeof EmailAddress.Type,
) {
  const [updated] = yield* query(async (database) => database.all(ensureAdminStatement(email)));
  if (updated === undefined) {
    return yield* new BootstrapUnavailable();
  }
  return yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(updated).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

export { BootstrappedAdmin, EmailAddress, bootstrapAdmin, bootstrapStatement, ensureAdminRole };
