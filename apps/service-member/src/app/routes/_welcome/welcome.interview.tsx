import { createFileRoute } from "@tanstack/react-router";

import { WelcomeInterviewPage } from "#pages/welcome/index.ts";

const Route = createFileRoute("/_welcome/welcome/interview")({
  component: WelcomeInterviewPage,
});

export { Route };
