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

type RolePromotion = Readonly<{
  bootstrapKind: BootstrapKind;
  email: typeof Email.Type;
  updatedAt: number;
}>;

const roleStatement = (
  { bootstrapKind, email, updatedAt }: RolePromotion,
  vacancy: (role: Role) => SQL,
): SQL => {
  const { permission, role } = bootstrapRoles[bootstrapKind];
  return sql`UPDATE ${user}
    SET role = ${role}, permission = ${permission}, updated_at = ${updatedAt}
    WHERE ${user.email} = ${email.toLowerCase()}
      AND ${user.emailVerified} = ${1}${vacancy(role)}
    RETURNING id, email, role, permission`;
};

const bootstrapStatement = (promotion: RolePromotion): SQL =>
  roleStatement(
    promotion,
    (role) => sql`
      AND ${user.role} = ${ROLE.member}
      AND NOT EXISTS (SELECT 1 FROM ${user} WHERE role = ${role})`,
  );

const ensureRoleStatement = (promotion: RolePromotion): SQL =>
  roleStatement(promotion, () => sql``);

class BootstrapUnavailable extends Schema.TaggedError<BootstrapUnavailable>()(
  "BootstrapUnavailable",
  {},
) {}

const bootstrapAdmin = Effect.fn("bootstrapAdmin")(function* bootstrapAdmin(
  email: typeof Email.Type,
  bootstrapKind: BootstrapKind = BOOTSTRAP_KIND.admin,
) {
  const updatedAt = yield* Clock.currentTimeMillis;
  const [promotedRow] = yield* query((database) =>
    database.all(bootstrapStatement({ bootstrapKind, email, updatedAt })),
  );
  if (promotedRow === undefined) {
    return yield* BootstrapUnavailable.make();
  }
  return yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(promotedRow).pipe(
    Effect.mapError((cause) => DatabaseFailure.make({ cause })),
  );
});

const ensureAdminRole = Effect.fn("ensureAdminRole")(function* ensureAdminRole(
  email: typeof Email.Type,
  bootstrapKind: BootstrapKind = BOOTSTRAP_KIND.admin,
) {
  const updatedAt = yield* Clock.currentTimeMillis;
  const [adminRow] = yield* query((database) =>
    database.all(ensureRoleStatement({ bootstrapKind, email, updatedAt })),
  );
  if (adminRow === undefined) {
    return yield* BootstrapUnavailable.make();
  }
  return yield* Schema.decodeUnknownEffect(BootstrappedAdmin)(adminRow).pipe(
    Effect.mapError((cause) => DatabaseFailure.make({ cause })),
  );
});

export {
  BOOTSTRAP_KIND,
  BootstrapKind,
  BootstrappedAdmin,
  BootstrapUnavailable,
  Email,
  bootstrapAdmin,
  bootstrapStatement,
  ensureAdminRole,
};
export type { RolePromotion };
