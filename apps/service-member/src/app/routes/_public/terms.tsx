import { AGREEMENT_KIND } from "@repo/config";
import { createFileRoute } from "@tanstack/react-router";

import { loadPublishedAgreement } from "#entities/agreement/index.ts";
import { TermsRoute } from "#pages/legal/index.ts";

const Route = createFileRoute("/_public/terms")({
  component: TermsRoute,
  loader: () => loadPublishedAgreement(AGREEMENT_KIND.terms),
});

export { Route };
