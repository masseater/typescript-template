import { SessionUserProvider } from "@repo/auth-ui";
import { SessionGate } from "@repo/auth-ui/session-gate";
import { ROLE } from "@repo/config";
import { Outlet } from "@tanstack/react-router";

import { AdminFrame } from "./admin-frame.tsx";

import type { ReactElement } from "react";

function AdminLayout(): ReactElement {
  return (
    <SessionGate role={ROLE.admin}>
      {(session) => (
        <SessionUserProvider user={session.user}>
          <AdminFrame email={session.user.email} name={session.user.name}>
            <Outlet />
          </AdminFrame>
        </SessionUserProvider>
      )}
    </SessionGate>
  );
}

export { AdminLayout };
