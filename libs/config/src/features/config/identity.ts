/** @canonical-values config.role */
export const roles = ["member", "admin", "staff"] as const;
export type Role = (typeof roles)[number];
export const ROLE = { member: roles[0], administrator: roles[1], staff: roles[2] } as const;

/** @canonical-values config.account-state */
export const accountStates = ["active", "suspended"] as const;
export type AccountState = (typeof accountStates)[number];
export const ACCOUNT_STATE = { active: accountStates[0], suspended: accountStates[1] } as const;

/** @canonical-values config.admin-permission */
export const adminPermissions = ["viewer", "operator", "owner"] as const;
export type AdminPermission = (typeof adminPermissions)[number];
export const ADMIN_PERMISSION = {
  viewer: adminPermissions[0],
  operator: adminPermissions[1],
  owner: adminPermissions[2],
} as const;

/** @canonical-values config.staff-permission */
export const staffPermissions = ["viewer", "editor"] as const;
export type StaffPermission = (typeof staffPermissions)[number];
export const STAFF_PERMISSION = {
  viewer: staffPermissions[0],
  editor: staffPermissions[1],
} as const;

export const accountPermissions = [...adminPermissions, STAFF_PERMISSION.editor] as const;
export type AccountPermission = (typeof accountPermissions)[number];

const levelIndex = (levels: readonly string[], held: string | null | undefined): number =>
  levels.findIndex((level) => level === held);

export const grantsAdminLevel = (
  held: string | null | undefined,
  required: AdminPermission,
): boolean => levelIndex(adminPermissions, held) >= adminPermissions.indexOf(required);

export const grantsStaffLevel = (
  held: string | null | undefined,
  required: StaffPermission,
): boolean => levelIndex(staffPermissions, held) >= staffPermissions.indexOf(required);

/** @canonical-values config.strong-authentication-method */
export const strongAuthenticationMethods = ["password_totp", "passkey_uv"] as const;
export type StrongAuthenticationMethod = (typeof strongAuthenticationMethods)[number];

/** @canonical-values config.authentication-method */
export const authenticationMethods = [
  "password",
  ...strongAuthenticationMethods,
  "recovery",
] as const;
export type AuthenticationMethod = (typeof authenticationMethods)[number];
export const AUTHENTICATION_METHOD = {
  password: authenticationMethods[0],
  passwordTotp: authenticationMethods[1],
  passkey: authenticationMethods[2],
  recovery: authenticationMethods[3],
} as const satisfies Record<string, AuthenticationMethod>;
