import { createFileRoute } from "@tanstack/react-router";

import { TermsVersionRoute } from "#pages/terms/index.ts";

const Route = createFileRoute("/_admin/terms/$version")({
  component: TermsVersionRoute,
});

export { Route };
