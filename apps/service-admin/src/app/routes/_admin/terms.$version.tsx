import { createFileRoute } from "@tanstack/react-router";

import { TermsVersionPage } from "#pages/terms/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_admin/terms/$version")({
  component: TermsVersionRoute,
});

function TermsVersionRoute(): ReactElement {
  const { version } = Route.useParams();
  return <TermsVersionPage version={version} />;
}

export { Route };
