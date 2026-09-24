import { createFileRoute } from "@tanstack/react-router";

import { TermsRoute } from "#pages/terms/index.ts";

const Route = createFileRoute("/_admin/terms")({
  component: TermsRoute,
  validateSearch: (search: Record<string, unknown>): Readonly<{ draft?: true }> =>
    search["draft"] === true ? { draft: true } : {},
});

export { Route };
