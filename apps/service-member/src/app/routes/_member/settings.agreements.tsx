import { createFileRoute } from "@tanstack/react-router";

import { SettingsAgreementsRoute } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/agreements")({
  component: SettingsAgreementsRoute,
});

export { Route };
