import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { welcomePath } from "#app/entry-conditions.ts";
import { WelcomeRecoveryPage } from "#pages/recovery/index.ts";

import type { ReactElement } from "react";

const welcome = getRouteApi("/_welcome");

function RecoveryRoute(): ReactElement {
  const { step } = welcome.useRouteContext();
  const nextPath = step === "done" ? "/home" : welcomePath[step];
  return <WelcomeRecoveryPage nextPath={nextPath} />;
}

const Route = createFileRoute("/_welcome/welcome/recovery")({
  component: RecoveryRoute,
});

export { Route };
