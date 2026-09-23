import { SessionGate } from "@repo/auth-ui";
import { Outlet } from "@tanstack/react-router";

import { WikiFrame } from "./wiki-frame.tsx";

import type { ReactElement } from "react";

function WikiLayout(): ReactElement {
  return (
    <SessionGate>
      {() => (
        <WikiFrame>
          <Outlet />
        </WikiFrame>
      )}
    </SessionGate>
  );
}

export { WikiLayout };
