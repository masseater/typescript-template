import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { loadAgreements } from "#entities/agreement/index.ts";
import { AgreementPage } from "#pages/account/welcome/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_welcome/welcome/agreement")({
  component: WelcomeAgreementRoute,
  gcTime: 0,
  loader: loadAgreements,
});

const route = getRouteApi("/_welcome/welcome/agreement");

function WelcomeAgreementRoute(): ReactElement {
  return <AgreementPage agreements={route.useLoaderData()} />;
}

export { Route };
