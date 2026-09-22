import { SessionUserProvider, loginPath, useSession } from "@repo/auth-ui";
import { STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { DashboardFrame } from "./dashboard-frame.tsx";

import type { ReactElement } from "react";

const SECURITY = "/security";

function DashboardLayout(): ReactElement | null {
  const { error, loading, session } = useSession();
  const { href, pathname } = useLocation();
  const navigate = useNavigate();
  const strong = session?.strong === true;
  const allowed = session !== undefined && (strong || pathname === SECURITY);
  useEffect(() => {
    if (loading || error !== undefined || allowed) {
      return;
    }
    void navigate({ href: session === undefined ? loginPath(href) : SECURITY, replace: true });
  }, [allowed, error, href, loading, navigate, session]);
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      </div>
    );
  }
  if (error !== undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
      </div>
    );
  }
  if (!allowed || session === undefined) {
    return null;
  }
  return (
    <SessionUserProvider user={session.user}>
      <DashboardFrame email={session.user.email} name={session.user.name}>
        <Outlet />
      </DashboardFrame>
    </SessionUserProvider>
  );
}

export { DashboardLayout };
