import { STATUS_VARIANT, StatusMessage, loginPath, useSession } from "@repo/ui";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AdminFrame } from "#widgets/admin-frame/index.ts";

import type { ReactElement } from "react";

const SECURITY = "/security";

function AdminLayout(): ReactElement {
  const { error, loading, session } = useSession();
  const { href, pathname } = useLocation();
  const navigate = useNavigate();
  const strong = session?.strong === true && session.user.role === "admin";
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
    <AdminFrame email={session.user.email} name={session.user.name}>
      <Outlet />
    </AdminFrame>
  );
}

export { AdminLayout };
