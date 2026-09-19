import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/")({
  component: SettingsPage,
});

export { Route };
