/** @canonical-values config.role */
export const roles = ["member", "admin"] as const;
export type Role = (typeof roles)[number];
export const ROLE = { member: roles[0], administrator: roles[1] } as const;

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
