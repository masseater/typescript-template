import { SessionUserProvider, loginPath, useSession } from "@repo/auth-ui";
import { ROLE } from "@repo/config";
import { STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AdminFrame } from "./admin-frame.tsx";

import type { ReactElement } from "react";

const SECURITY = "/security";

function AdminLayout(): ReactElement {
  const { error, loading, session } = useSession();
  const { href, pathname } = useLocation();
  const navigate = useNavigate();
  const strong = session?.strong === true && session.user.role === ROLE.administrator;
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
          <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
        ) : (
          <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>
        )}
      </div>
    );
  }
  return (
    <SessionUserProvider user={session.user}>
      <AdminFrame email={session.user.email} name={session.user.name}>
        <Outlet />
      </AdminFrame>
    </SessionUserProvider>
  );
}

export { AdminLayout };
