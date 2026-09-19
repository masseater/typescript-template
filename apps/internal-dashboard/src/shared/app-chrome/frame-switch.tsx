import { ButtonLink } from "@repo/ui";
import { useLocation } from "@tanstack/react-router";

import type { ReactElement } from "react";

const dashboardPath = "/";
const wikiPath = "/wiki";

function FrameSwitch(): ReactElement {
  const { pathname } = useLocation();
  const onWiki = pathname === wikiPath || pathname.startsWith(`${wikiPath}/`);
  return (
    <nav aria-label="枠の切替" className="flex items-center gap-1">
      <ButtonLink to={dashboardPath} variant={onWiki ? "secondary" : "primary"}>
        ダッシュボード
      </ButtonLink>
      <ButtonLink to={wikiPath} variant={onWiki ? "primary" : "secondary"}>
        Wiki
      </ButtonLink>
    </nav>
  );
}

export { FrameSwitch };
