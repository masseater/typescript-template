import { createFileRoute } from "@tanstack/react-router";

import { InterviewSettingsPage } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/interview")({
  component: InterviewSettingsPage,
});

export { Route };
