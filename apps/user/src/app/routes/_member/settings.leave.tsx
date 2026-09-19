import { createFileRoute } from "@tanstack/react-router";

import { LeavePage } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/leave")({
  component: LeavePage,
});

export { Route };
