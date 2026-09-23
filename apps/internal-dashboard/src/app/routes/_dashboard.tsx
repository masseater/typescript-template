import { createFileRoute } from "@tanstack/react-router";

import { DashboardLayout } from "#widgets/dashboard-frame/index.ts";

const Route = createFileRoute("/_dashboard")({ component: DashboardLayout });

export { Route };
