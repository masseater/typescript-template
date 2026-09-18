import { AdminLayout } from "./-admin-layout.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_admin")({ component: AdminLayout });

export { Route };
