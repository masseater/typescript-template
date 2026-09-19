import { createFileRoute } from "@tanstack/react-router";

import { TermsPage } from "#pages/terms/index.ts";

const Route = createFileRoute("/_admin/terms")({
  component: TermsPage,
});

export { Route };
