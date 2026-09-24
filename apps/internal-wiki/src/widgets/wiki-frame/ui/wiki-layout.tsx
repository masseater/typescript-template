import { SessionGate } from "@repo/auth-ui/session-gate";
import { Outlet } from "@tanstack/react-router";

import { WikiFrame } from "./wiki-frame.tsx";

import type { ReactElement } from "react";

function WikiLayout(): ReactElement {
  return (
    <SessionGate reloadDocument securityExempt={false}>
      {() => (
        <WikiFrame>
          <Outlet />
        </WikiFrame>
      )}
    </SessionGate>
  );
}

export { WikiLayout };
