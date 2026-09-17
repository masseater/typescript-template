import { LoginRoute } from "./-login-route.tsx";
import { createFileRoute } from "@tanstack/react-router";
import { safeDestination } from "#app/entry-conditions.ts";

const Route = createFileRoute("/_public/login")({
  component: LoginRoute,
  validateSearch: (search: Readonly<Record<string, unknown>>): { redirect?: string } => {
    const destination = safeDestination(
      typeof search["redirect"] === "string" ? search["redirect"] : undefined,
    );
    return destination === undefined ? {} : { redirect: destination };
  },
});

export { Route };
