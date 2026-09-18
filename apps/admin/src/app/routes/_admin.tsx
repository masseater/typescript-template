import { createFileRoute } from "@tanstack/react-router";

import { AdminLayout } from "./-admin-layout.tsx";

const Route = createFileRoute("/_admin")({ component: AdminLayout });

export { Route };
