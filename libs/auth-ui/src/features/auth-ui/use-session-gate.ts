import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { loginPath } from "./login-redirect.ts";
import { useSession } from "./use-session.ts";

import type { Role } from "@repo/config";
import type { SessionView } from "./protocol.ts";

const SECURITY_PATH = "/security";

const useSessionGate = (
  role: Role | undefined,
): Readonly<{ error: string | undefined; loading: boolean; session: SessionView | undefined }> => {
  const { error, loading, session } = useSession();
  const { href, pathname } = useLocation();
  const navigate = useNavigate();
  const permitted = session?.strong === true && (role === undefined || session.user.role === role);
  const allowed = session !== undefined && (permitted || pathname === SECURITY_PATH);
  useEffect(() => {
    if (loading || error !== undefined || allowed) {
      return;
    }
    void navigate({ href: session === undefined ? loginPath(href) : SECURITY_PATH, replace: true });
  }, [allowed, error, href, loading, navigate, session]);
  return { error, loading, session: allowed ? session : undefined };
};

export { useSessionGate };
