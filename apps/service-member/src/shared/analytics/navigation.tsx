import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import { analyticsConsentGranted } from "./consent.ts";
import { trackAnalyticsPageView } from "./track-page-view.ts";

function MemberAnalyticsNavigation(): null {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => {
    if (!analyticsConsentGranted()) {
      return;
    }
    trackAnalyticsPageView(pathname);
  }, [pathname]);
  return null;
}

export { MemberAnalyticsNavigation };
