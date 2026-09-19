import { createFileRoute } from "@tanstack/react-router";

import { DashboardLayout } from "./-dashboard-layout.tsx";

const Route = createFileRoute("/_dashboard")({ component: DashboardLayout });

export { Route };
