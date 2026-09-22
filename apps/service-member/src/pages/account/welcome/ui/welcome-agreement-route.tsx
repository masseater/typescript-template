import { getRouteApi } from "@tanstack/react-router";

import { AgreementPage } from "./agreement-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_welcome/welcome/agreement");

function WelcomeAgreementRoute(): ReactElement {
  return <AgreementPage agreements={route.useLoaderData()} />;
}

export { WelcomeAgreementRoute };
