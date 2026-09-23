import { SessionGate } from "@repo/auth-ui";
import { ROLE } from "@repo/config";
import { Outlet } from "@tanstack/react-router";

import { AdminFrame } from "./admin-frame.tsx";

import type { ReactElement } from "react";

function AdminLayout(): ReactElement {
  return (
    <SessionGate role={ROLE.administrator}>
      {(session) => (
        <AdminFrame email={session.user.email} name={session.user.name}>
          <Outlet />
        </AdminFrame>
      )}
    </SessionGate>
  );
}

export { AdminLayout };
