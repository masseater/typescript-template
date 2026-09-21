import { createFileRoute } from "@tanstack/react-router";

import { InterviewSettingsPage, loadInterviewView } from "#pages/settings/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_member/settings/interview")({
  component: InterviewSettingsRoute,
  loader: loadInterviewView,
});

function InterviewSettingsRoute(): ReactElement {
  const interview = Route.useLoaderData();
  return <InterviewSettingsPage interview={interview} />;
}

export { Route };
