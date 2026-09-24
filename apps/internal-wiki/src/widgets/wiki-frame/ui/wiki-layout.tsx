import { useSession } from "@repo/auth-ui/session";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { wikiAllowed, wikiRedirect } from "#widgets/wiki-frame/model/wiki-redirect.ts";
import { WikiFrame } from "./wiki-frame.tsx";
import { WikiGate } from "./wiki-gate.tsx";

import type { ReactElement } from "react";

function WikiLayout(): ReactElement {
  const state = useSession();
  const { href } = useLocation();
  const navigate = useNavigate();
  const target = wikiRedirect(state, href);
  useEffect(() => {
    if (target === undefined) {
      return;
    }
    void navigate({ href: target, reloadDocument: true, replace: true });
  }, [navigate, state.session, target]);
  return (
    <WikiGate allowed={wikiAllowed(state)} error={state.error} loading={state.loading}>
      <WikiFrame>
        <Outlet />
      </WikiFrame>
    </WikiGate>
  );
}

export { WikiLayout };
