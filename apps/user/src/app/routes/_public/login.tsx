import { LoginRoute } from "./-login-route.tsx";
import { createFileRoute } from "@tanstack/react-router";
import { redirectTarget } from "@template/ui";

const Route = createFileRoute("/_public/login")({
  component: LoginRoute,
  validateSearch: (search: Readonly<Record<string, unknown>>): { redirect?: string } =>
    search["redirect"] === undefined ? {} : { redirect: redirectTarget(search["redirect"]) },
});

export { Route };
