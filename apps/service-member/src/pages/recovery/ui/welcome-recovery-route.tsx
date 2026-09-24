import { getRouteApi } from "@tanstack/react-router";

import { WelcomeRecoveryPage } from "./welcome-recovery-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_welcome/welcome/recovery");

function WelcomeRecoveryRoute(): ReactElement {
  const { nextPath } = route.useLoaderData();
  return <WelcomeRecoveryPage nextPath={nextPath} />;
}

export { WelcomeRecoveryRoute };
