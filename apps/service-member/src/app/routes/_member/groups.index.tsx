import { createFileRoute } from "@tanstack/react-router";

import { GroupsFailed, GroupsPending, loadOpenGroups } from "#pages/messages/index.ts";
import { GroupsRoute } from "./-groups-route.tsx";

const Route = createFileRoute("/_member/groups/")({
  loader: async () => loadOpenGroups(),
  component: GroupsRoute,
  errorComponent: GroupsFailed,
  pendingComponent: GroupsPending,
});

export { Route };
