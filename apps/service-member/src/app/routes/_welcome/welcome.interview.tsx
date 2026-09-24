import { createFileRoute } from "@tanstack/react-router";

import { WelcomeInterviewPage } from "#pages/account/welcome/index.ts";

const Route = createFileRoute("/_welcome/welcome/interview")({
  component: WelcomeInterviewPage,
});

export { Route };
