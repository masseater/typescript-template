import { resultError, resultValue } from "@repo/ui";

import { useOverview } from "#pages/overview/model/overview.ts";
import { OverviewView } from "./overview-view.tsx";

import type { ReactElement } from "react";

function OverviewPage(): ReactElement {
  const listing = useOverview();
  return <OverviewView error={resultError(listing)} overview={resultValue(listing)} />;
}

export { OverviewPage };
