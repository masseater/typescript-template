import { ROLE } from "@repo/config";
import { sql, type SQL } from "drizzle-orm";
import { Effect, Schema, Struct } from "effect";

import { DatabaseFailure } from "./database-failure.ts";
import { query } from "./database.ts";
import { UserRow } from "./identity-schema.ts";
import { user } from "./schema.ts";

const EmailAddress = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u));

const BootstrappedAdmin = Schema.Struct({
  ...Struct.pick(UserRow.fields, ["email", "id"]),
  role: Schema.Literal(ROLE.administrator),
});

const bootstrapStatement = (email: typeof EmailAddress.Type): SQL => {
  return sql`UPDATE ${user}
    SET role = ${ROLE.administrator}, updated_at = ${Date.now()}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${ROLE.administrator})
    RETURNING id, email, role`;
};

class BootstrapUnavailable extends Schema.TaggedError<BootstrapUnavailable>()(
  "BootstrapUnavailable",
  {},
) {}

const bootstrapAdmin = Effect.fn("bootstrapAdmin")(function* bootstrapAdmin(
  email: typeof EmailAddress.Type,
) {
  const [promotedRow] = yield* query(async (database) => database.all(bootstrapStatement(email)));
  if (promotedRow === undefined) {
    return yield* new BootstrapUnavailable();
  }
  return yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(promotedRow).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

export {
  BootstrapUnavailable,
  BootstrappedAdmin,
  EmailAddress,
  bootstrapAdmin,
  bootstrapStatement,
};
