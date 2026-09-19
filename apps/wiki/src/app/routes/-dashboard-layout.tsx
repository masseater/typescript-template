import { Status, loginPath, useSession } from "@repo/ui";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { DashboardFrame } from "#widgets/dashboard-frame/index.ts";

import type { ReactElement } from "react";

const SECURITY = "/security";

function DashboardLayout(): ReactElement {
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
  if (!allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        {error === undefined ? (
          <Status variant="pending">読み込み中です。</Status>
        ) : (
          <Status variant="error">{error}</Status>
        )}
      </div>
    );
  }
  return (
    <DashboardFrame email={session.user.email} name={session.user.name}>
      <Outlet />
    </DashboardFrame>
  );
}

export { DashboardLayout };
