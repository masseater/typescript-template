import { createFileRoute } from "@tanstack/react-router";

import { redirectTarget } from "@repo/ui";

import { LoginRoute } from "./-login-route.tsx";

const Route = createFileRoute("/_public/login")({
  component: LoginRoute,
  validateSearch: (search: Readonly<Record<string, unknown>>): { redirect?: string } =>
    search["redirect"] === undefined ? {} : { redirect: redirectTarget(search["redirect"]) },
});

export { Route };
