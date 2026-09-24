import { getRouteApi } from "@tanstack/react-router";

import { ReconsentPage } from "./reconsent-page.tsx";

import type { ReactElement } from "react";

const home = "/home";
const route = getRouteApi("/_member/agreement");

function AgreementRoute(): ReactElement {
  const { agreements } = route.useRouteContext();
  const { redirect: destination } = route.useSearch();
  return <ReconsentPage agreements={agreements} destination={destination ?? home} />;
}

export { AgreementRoute };
