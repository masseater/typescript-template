import { ADMIN_PERMISSION, Email, ROLE, STAFF_PERMISSION, type Role } from "@repo/config";
import { sql, type SQL } from "drizzle-orm";
import { Clock, Effect, Schema, Struct } from "effect";

import { DatabaseFailure } from "./database-failure.ts";
import { query } from "./database.ts";
import { UserRow } from "./identity-schema.ts";
import { user } from "./schema.ts";

/** @canonical-values db.bootstrap-kind */
const bootstrapKinds = ["admin", "staff"] as const;
const BOOTSTRAP_KIND = { admin: bootstrapKinds[0], staff: bootstrapKinds[1] } as const;
const BootstrapKind = Schema.Literals(bootstrapKinds);
type BootstrapKind = typeof BootstrapKind.Type;

const bootstrapRoles = {
  [BOOTSTRAP_KIND.admin]: { permission: ADMIN_PERMISSION.owner, role: ROLE.administrator },
  [BOOTSTRAP_KIND.staff]: { permission: STAFF_PERMISSION.editor, role: ROLE.staff },
} as const satisfies Readonly<Record<BootstrapKind, { permission: string; role: Role }>>;

const BootstrappedAdmin = Schema.Struct({
  ...Struct.pick(UserRow.fields, ["email", "id"]),
  permission: Schema.Literals([ADMIN_PERMISSION.owner, STAFF_PERMISSION.editor]),
  role: Schema.Literals([ROLE.administrator, ROLE.staff]),
});

const bootstrapStatement = (
  email: typeof Email.Type,
  kind: BootstrapKind,
  updatedAt: number,
): SQL => {
  const { permission, role } = bootstrapRoles[kind];
  return sql`UPDATE ${user}
    SET role = ${role}, permission = ${permission}, updated_at = ${updatedAt}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
      AND ${user.role} = ${ROLE.member}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${role})
    RETURNING id, email, role, permission`;
};

const ensureRoleStatement = (
  email: typeof Email.Type,
  kind: BootstrapKind,
  updatedAt: number,
): SQL => {
  const { permission, role } = bootstrapRoles[kind];
  return sql`UPDATE ${user}
    SET role = ${role}, permission = ${permission}, updated_at = ${updatedAt}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}
    RETURNING id, email, role, permission`;
};

class BootstrapUnavailable extends Schema.TaggedError<BootstrapUnavailable>()(
  "BootstrapUnavailable",
  {},
) {}

const bootstrapAdmin = Effect.fn("bootstrapAdmin")(function* bootstrapAdmin(
  email: typeof Email.Type,
  kind: BootstrapKind = BOOTSTRAP_KIND.admin,
) {
  const updatedAt = yield* Clock.currentTimeMillis;
  const [promotedRow] = yield* query((database) =>
    database.all(bootstrapStatement(email, kind, updatedAt)),
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
  kind: BootstrapKind = BOOTSTRAP_KIND.admin,
) {
  const updatedAt = yield* Clock.currentTimeMillis;
  const [updated] = yield* query((database) =>
    database.all(ensureRoleStatement(email, kind, updatedAt)),
  );
  if (updated === undefined) {
    return yield* new BootstrapUnavailable();
  }
  return yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(updated).pipe(
    Effect.mapError((cause) => new DatabaseFailure({ cause })),
  );
});

export {
  BOOTSTRAP_KIND,
  BootstrapKind,
  BootstrappedAdmin,
  Email,
  bootstrapAdmin,
  bootstrapStatement,
  ensureAdminRole,
};
