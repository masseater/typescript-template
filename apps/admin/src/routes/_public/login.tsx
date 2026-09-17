import { AdminLogin } from "#components/admin-login.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_public/login")({ component: AdminLogin });

export { Route };
