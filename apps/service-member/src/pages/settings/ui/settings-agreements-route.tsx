import { getRouteApi } from "@tanstack/react-router";

import { AgreementsPage } from "./agreements-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/settings/agreements");

function SettingsAgreementsRoute(): ReactElement {
  const { agreements } = route.useRouteContext();
  return <AgreementsPage agreements={agreements} />;
}

export { SettingsAgreementsRoute };
