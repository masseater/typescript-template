import { createFileRoute } from "@tanstack/react-router";

import { AdminLayout } from "#widgets/admin-frame/index.ts";

const Route = createFileRoute("/_admin")({ component: AdminLayout });

export { Route };
