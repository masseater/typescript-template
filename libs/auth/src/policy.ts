import {
  ACCOUNT_STATE,
  APPLICATION,
  AUTHENTICATION_METHOD,
  ROLE,
  strongAuthenticationMethods,
  type Application,
  type AuthenticationMethod,
} from "@repo/config";
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

const deny = (denial: string): never => {
  throw new APIError("FORBIDDEN", { message: denial });
};

const strongMethods: ReadonlySet<string> = new Set(strongAuthenticationMethods);

const isStrongMethod = (method: string): boolean => strongMethods.has(method);

const sessionIsLive = (
  sessionRecord: {
    readonly session: {
      readonly audience: Application;
      readonly expiresAt: Date;
      readonly securityVersion: number;
    };
    readonly user: {
      readonly emailVerified: boolean;
      readonly securityVersion: number;
    };
  },
  audience: Application,
): boolean =>
  sessionRecord.session.expiresAt > new Date() &&
  sessionRecord.session.audience === audience &&
  sessionRecord.session.securityVersion === sessionRecord.user.securityVersion &&
  sessionRecord.user.emailVerified;

const authenticationMethodsByPath = new Map<string, AuthenticationMethod>([
  ["/passkey/verify-authentication", AUTHENTICATION_METHOD.passkey],
  ["/two-factor/verify-totp", AUTHENTICATION_METHOD.passwordTotp],
  ["/two-factor/verify-backup-code", AUTHENTICATION_METHOD.recovery],
]);

const authenticationMethodFor = (path: string | undefined): AuthenticationMethod =>
  (path === undefined ? undefined : authenticationMethodsByPath.get(path)) ??
  AUTHENTICATION_METHOD.password;

type EligibleUser = {
  readonly accountState?: string;
  readonly emailVerified: boolean;
  readonly role: string;
};

const assertEligibleUser: <TUser extends EligibleUser>(
  eligibleUser: TUser | undefined,
  audience: Application,
) => asserts eligibleUser is TUser = (eligibleUser, audience) => {
  if (eligibleUser === undefined || !eligibleUser.emailVerified) {
    deny("VERIFIED_EMAIL_REQUIRED");
  }
  if (
    eligibleUser.accountState !== undefined &&
    eligibleUser.accountState !== ACCOUNT_STATE.active
  ) {
    deny("ACCOUNT_INACTIVE");
  }
  if (audience === APPLICATION.user && eligibleUser.role !== ROLE.member) {
    deny("MEMBER_REQUIRED");
  }
  if (audience === APPLICATION.admin && eligibleUser.role !== ROLE.administrator) {
    deny("ADMIN_REQUIRED");
  }
  if (audience === APPLICATION.wiki && eligibleUser.role !== ROLE.staff) {
    deny("ADMIN_REQUIRED");
  }
};

export {
  assertEligibleUser,
  authenticationMethodFor,
  deny,
  enrollmentPaths,
  isStrongMethod,
  sessionIsLive,
};
