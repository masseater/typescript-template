import { audienceRoles, type Application } from "@repo/config";
import {
  ACCOUNT_STATE,
  AUTHENTICATION_METHOD,
  ROLE,
  strongAuthenticationMethods,
  type AccountState,
  type AuthenticationMethod,
} from "@repo/config/identity";
import { APIError } from "better-auth/api";

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

function deny(denial: string): never {
  throw new APIError("FORBIDDEN", { message: denial });
}

const strongMethods: ReadonlySet<string> = new Set(strongAuthenticationMethods);

const isStrongMethod = (method: string): boolean => strongMethods.has(method);

const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const STEP_UP_MINUTES = 10;
const STEP_UP_MILLISECONDS = STEP_UP_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

const isRecentlyStrong = (
  sessionRecord: {
    readonly authenticatedAt: Date | null;
    readonly authenticationMethod: string;
  },
  now: Date = new Date(),
): boolean =>
  isStrongMethod(sessionRecord.authenticationMethod) &&
  sessionRecord.authenticatedAt !== null &&
  now.getTime() - sessionRecord.authenticatedAt.getTime() < STEP_UP_MILLISECONDS;

const sessionIsLive = (
  sessionRecord: {
    readonly session: {
      readonly audience: Application;
      readonly expiresAt: Date;
      readonly securityVersion: number;
    };
    readonly user: {
      readonly accountState: AccountState;
      readonly emailVerified: boolean;
      readonly role: string;
      readonly securityVersion: number;
    };
  },
  audience: Application,
): boolean =>
  sessionRecord.session.expiresAt > new Date() &&
  sessionRecord.session.audience === audience &&
  sessionRecord.session.securityVersion === sessionRecord.user.securityVersion &&
  sessionRecord.user.emailVerified &&
  sessionRecord.user.accountState === ACCOUNT_STATE.active &&
  sessionRecord.user.role === audienceRoles[audience];

const isPrivilegedRole = (role: string): boolean => role !== ROLE.member;

const authenticationMethodsByPath = new Map<string, AuthenticationMethod>([
  ["/passkey/verify-authentication", AUTHENTICATION_METHOD.passkey],
  ["/two-factor/verify-totp", AUTHENTICATION_METHOD.passwordTotp],
  ["/two-factor/verify-backup-code", AUTHENTICATION_METHOD.recovery],
]);

const authenticationMethodFor = (path: string | undefined): AuthenticationMethod =>
  (path === undefined ? undefined : authenticationMethodsByPath.get(path)) ??
  AUTHENTICATION_METHOD.password;

const assertEligibleUser: <
  TUser extends {
    readonly accountState: AccountState;
    readonly emailVerified: boolean;
    readonly role: string;
  },
>(
  eligibleUser: TUser | undefined,
  audience: Application,
) => asserts eligibleUser is TUser = (eligibleUser, audience) => {
  if (eligibleUser === undefined || !eligibleUser.emailVerified) {
    deny("VERIFIED_EMAIL_REQUIRED");
  }
  if (eligibleUser.accountState !== ACCOUNT_STATE.active) {
    deny("ACCOUNT_SUSPENDED");
  }
  if (eligibleUser.role !== audienceRoles[audience]) {
    deny("ROLE_REQUIRED");
  }
};

export {
  assertEligibleUser,
  authenticationMethodFor,
  deny,
  enrollmentPaths,
  isPrivilegedRole,
  isRecentlyStrong,
  isStrongMethod,
  sessionIsLive,
};
