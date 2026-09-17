import { AdminLayout } from "#components/admin-layout.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_admin")({ component: AdminLayout });

export { Route };
