import { createFileRoute } from "@tanstack/react-router";

import { AgreementPage } from "#pages/account/welcome/index.ts";

const Route = createFileRoute("/_welcome/welcome/agreement")({
  component: AgreementPage,
});

export { Route };
