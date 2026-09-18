import { strongAuthenticationMethods, type Application } from "@template/config";
import { APIError } from "better-auth/api";

type EligibleUser = {
  readonly emailVerified: boolean;
  readonly role: string;
};

const enrollmentPaths = new Set([
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

type AuthenticationMethod = "passkey_uv" | "password" | "password_totp" | "recovery";

const strongMethods: ReadonlySet<string> = new Set(strongAuthenticationMethods);

const isStrongMethod = (method: string): boolean => {
  return strongMethods.has(method);
};

const authenticationMethodsByPath = new Map<string, AuthenticationMethod>([
  ["/passkey/verify-authentication", "passkey_uv"],
  ["/two-factor/verify-totp", "password_totp"],
  ["/two-factor/verify-backup-code", "recovery"],
]);

const authenticationMethodFor = (path: string | undefined): AuthenticationMethod => {
  return (path === undefined ? undefined : authenticationMethodsByPath.get(path)) ?? "password";
};

const deny: (message: string) => never = (message) => {
  throw new APIError("FORBIDDEN", { message });
};

const assertEligibleUser: <TUser extends EligibleUser>(
  user: TUser | undefined,
  audience: Application,
) => asserts user is TUser = (user, audience) => {
  if (user?.emailVerified !== true) {
    deny("VERIFIED_EMAIL_REQUIRED");
  }
  if (audience !== "user" && user.role !== "admin") {
    deny("ADMIN_REQUIRED");
  }
};

export { assertEligibleUser, authenticationMethodFor, deny, enrollmentPaths, isStrongMethod };
