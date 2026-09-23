import { createFileRoute } from "@tanstack/react-router";

import { WelcomeProfilePage } from "#pages/account/welcome/index.ts";

const Route = createFileRoute("/_welcome/welcome/profile")({
  component: WelcomeProfilePage,
});

export { Route };
