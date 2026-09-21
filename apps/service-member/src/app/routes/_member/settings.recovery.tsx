import { createFileRoute } from "@tanstack/react-router";

import { SettingsRecoveryPage } from "#pages/account/recovery/index.ts";

const Route = createFileRoute("/_member/settings/recovery")({
  component: SettingsRecoveryPage,
});

export { Route };
