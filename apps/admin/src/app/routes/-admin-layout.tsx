import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Status, loginPath, useSession } from "@template/ui";
import { AdminFrame } from "#widgets/admin-frame/index.ts";
import type { ReactElement } from "react";
import { useEffect } from "react";

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
      <div className="flex min-h-screen items-center justify-center p-4">
        {error === undefined ? (
          <Status variant="pending">読み込み中です。</Status>
        ) : (
          <Status variant="error">{error}</Status>
        )}
      </div>
    );
  }
  return (
    <AdminFrame email={session.user.email}>
      <Outlet />
    </AdminFrame>
  );
}

export { AdminLayout };
