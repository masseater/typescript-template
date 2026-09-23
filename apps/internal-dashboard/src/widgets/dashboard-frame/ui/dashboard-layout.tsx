import { SessionGate, SessionUserProvider } from "@repo/auth-ui";
import { Outlet } from "@tanstack/react-router";

import { DashboardFrame } from "./dashboard-frame.tsx";

import type { ReactElement } from "react";

function DashboardLayout(): ReactElement {
  return (
    <SessionGate>
      {(session) => (
        <SessionUserProvider user={session.user}>
          <DashboardFrame email={session.user.email} name={session.user.name}>
            <Outlet />
          </DashboardFrame>
        </SessionUserProvider>
      )}
    </SessionGate>
  );
}

export { DashboardLayout };
