import { AdminLogin } from "#pages/login/index.ts";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_public/login")({ component: AdminLogin });

export { Route };
