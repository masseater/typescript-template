import {
  APPLICATION,
  AUTHENTICATION_METHOD,
  ROLE,
  strongAuthenticationMethods,
  type Application,
  type AuthenticationMethod,
} from "@template/config";
import { APIError } from "better-auth/api";

export const enrollmentPaths = new Set([
  "/get-session",
  "/sign-out",
  "/two-factor/enable",
  "/two-factor/verify-totp",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/list-user-passkeys",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
]);

const strongMethods: ReadonlySet<string> = new Set(strongAuthenticationMethods);

export const isStrongMethod = (method: string): boolean => {
  return strongMethods.has(method);
};

const authenticationMethodsByPath = new Map<string, AuthenticationMethod>([
  ["/passkey/verify-authentication", AUTHENTICATION_METHOD.passkey],
  ["/two-factor/verify-totp", AUTHENTICATION_METHOD.passwordTotp],
  ["/two-factor/verify-backup-code", AUTHENTICATION_METHOD.recovery],
]);

export const authenticationMethodFor = (path: string | undefined): AuthenticationMethod => {
  return (
    (path === undefined ? undefined : authenticationMethodsByPath.get(path)) ??
    AUTHENTICATION_METHOD.password
  );
};

export const deny: (denialCode: string) => never = (denialCode) => {
  throw new APIError("FORBIDDEN", { message: denialCode });
};

export const assertEligibleUser: <
  TUser extends { readonly emailVerified: boolean; readonly role: string },
>(
  user: TUser | undefined,
  audience: Application,
) => asserts user is TUser = (user, audience) => {
  if (user?.emailVerified !== true) {
    deny("VERIFIED_EMAIL_REQUIRED");
  }
  if (audience !== APPLICATION.user && user.role !== ROLE.administrator) {
    deny("ADMIN_REQUIRED");
  }
};
