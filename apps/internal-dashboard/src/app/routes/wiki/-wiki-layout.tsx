import { Outlet } from "@tanstack/react-router";

import { WikiFrame } from "#widgets/wiki-frame/index.ts";

import type { ReactElement } from "react";

function WikiLayout(): ReactElement {
  return (
    <WikiFrame>
      <Outlet />
    </WikiFrame>
  );
}

export { WikiLayout };
