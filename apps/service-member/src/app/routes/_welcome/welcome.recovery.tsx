import { createFileRoute } from "@tanstack/react-router";

import { WelcomeRecoveryPage } from "#pages/recovery/index.ts";

const Route = createFileRoute("/_welcome/welcome/recovery")({
  component: WelcomeRecoveryPage,
});

export { Route };
