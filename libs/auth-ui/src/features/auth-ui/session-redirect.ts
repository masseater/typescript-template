import { loginPath } from "./login-redirect.ts";

import type { Role } from "@repo/config";

const SECURITY_PATH = "/security";

const sessionAllowed = (
  session: Readonly<{ strong: boolean; user: Readonly<{ role: Role }> }> | undefined,
  visit: Readonly<{ pathname: string; role: Role | undefined; securityExempt: boolean }>,
): boolean =>
  session !== undefined &&
  ((session.strong && (visit.role === undefined || session.user.role === visit.role)) ||
    (visit.securityExempt && visit.pathname === SECURITY_PATH));

const sessionRedirect = (
  reading: Readonly<{
    error: string | undefined;
    loading: boolean;
    session: Parameters<typeof sessionAllowed>[0];
  }>,
  visit: Parameters<typeof sessionAllowed>[1] & Readonly<{ href: string }>,
): string | undefined => {
  if (reading.loading || reading.error !== undefined || sessionAllowed(reading.session, visit)) {
    return undefined;
  }
  return reading.session === undefined ? loginPath(visit.href) : SECURITY_PATH;
};

export { sessionAllowed, sessionRedirect };
