import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { AgreementsPage } from "#pages/settings/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/settings/agreements")({
  component: SettingsAgreementsRoute,
});

const route = getRouteApi("/_member/settings/agreements");

function SettingsAgreementsRoute(): ReactElement {
  const { agreements } = route.useRouteContext();
  return <AgreementsPage agreements={agreements} />;
}

export { Route };
