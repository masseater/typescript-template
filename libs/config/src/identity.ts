const roles = ["user", "admin"] as const;
type Role = (typeof roles)[number];
const strongAuthenticationMethods = ["password_totp", "passkey_uv"] as const;
type StrongAuthenticationMethod = (typeof strongAuthenticationMethods)[number];
const authenticationMethods = ["password", ...strongAuthenticationMethods, "recovery"] as const;

export { authenticationMethods, roles, strongAuthenticationMethods };
export type { Role, StrongAuthenticationMethod };
