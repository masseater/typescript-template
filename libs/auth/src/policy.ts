import { APIError } from "better-auth/api";
import type { Audience } from "@template/db";

type AuthenticationMethod = "passkey_uv" | "password" | "password_totp" | "recovery";

interface EligibleUser {
  readonly emailVerified: boolean;
  readonly role: string;
}

const strongMethods = new Set(["password_totp", "passkey_uv"]);

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

const authenticationMethodsByPath = new Map<string, AuthenticationMethod>([
  ["/passkey/verify-authentication", "passkey_uv"],
  ["/two-factor/verify-totp", "password_totp"],
  ["/two-factor/verify-backup-code", "recovery"],
]);

function deny(message: string): never {
  throw new APIError("FORBIDDEN", { message });
}

function isStrongMethod(method: string): boolean {
  return strongMethods.has(method);
}

function authenticationMethodFor(path: string | undefined): AuthenticationMethod {
  return (path === undefined ? undefined : authenticationMethodsByPath.get(path)) ?? "password";
}

function assertEligibleUser<TUser extends EligibleUser>(
  user: TUser | undefined,
  audience: Audience,
): asserts user is TUser {
  if (user?.emailVerified !== true) {
    deny("VERIFIED_EMAIL_REQUIRED");
  }
  if (audience === "admin" && user.role !== "admin") {
    deny("ADMIN_REQUIRED");
  }
}

export { assertEligibleUser, authenticationMethodFor, deny, enrollmentPaths, isStrongMethod };
