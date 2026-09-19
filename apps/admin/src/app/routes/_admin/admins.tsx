import { createFileRoute } from "@tanstack/react-router";

import { AdminsPage } from "#pages/admins/index.ts";

const Route = createFileRoute("/_admin/admins")({
  component: AdminsPage,
});

export { Route };
