import { createFileRoute } from "@tanstack/react-router";

import { AdminLogin } from "#pages/login/index.ts";

const Route = createFileRoute("/_public/login")({ component: AdminLogin });

export { Route };
