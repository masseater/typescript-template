import { createFileRoute } from "@tanstack/react-router";

import { TermsPage } from "#pages/terms/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_admin/terms")({
  component: TermsRoute,
  validateSearch: (search: Record<string, unknown>): Readonly<{ draft?: true }> =>
    search["draft"] === true ? { draft: true } : {},
});

function TermsRoute(): ReactElement {
  const { draft } = Route.useSearch();
  return <TermsPage drafting={draft === true} />;
}

export { Route };
