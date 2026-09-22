import { createFileRoute } from "@tanstack/react-router";

import { SecuritySettingsPage } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/security")({
  component: SecuritySettingsPage,
});

export { Route };
