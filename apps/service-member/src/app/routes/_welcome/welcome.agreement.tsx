import { createFileRoute } from "@tanstack/react-router";

import { loadAgreements } from "#entities/agreement/index.ts";
import { WelcomeAgreementRoute } from "#pages/account/welcome/index.ts";

const Route = createFileRoute("/_welcome/welcome/agreement")({
  component: WelcomeAgreementRoute,
  gcTime: 0,
  loader: loadAgreements,
});

export { Route };
