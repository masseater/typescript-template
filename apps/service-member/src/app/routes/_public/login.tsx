import { redirectTarget } from "@repo/auth-ui";
import { createFileRoute } from "@tanstack/react-router";

import { LoginRoute } from "#pages/account/login/index.ts";

const Route = createFileRoute("/_public/login")({
  component: LoginRoute,
  validateSearch: (search: Readonly<Record<string, unknown>>): { redirect?: string } =>
    search["redirect"] === undefined ? {} : { redirect: redirectTarget(search["redirect"]) },
});

export { Route };
