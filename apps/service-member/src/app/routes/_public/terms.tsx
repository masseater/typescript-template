import { AGREEMENT_KIND } from "@repo/config";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { loadPublishedAgreement } from "#entities/agreement/index.ts";
import { LegalDocumentPage } from "#pages/legal/index.ts";

import type { ReactElement } from "react";
const Route = createFileRoute("/_public/terms")({
  component: TermsRoute,
  loader: () => loadPublishedAgreement(AGREEMENT_KIND.terms),
});
const route = getRouteApi("/_public/terms");
function TermsRoute(): ReactElement {
  return <LegalDocumentPage document={route.useLoaderData()} kind={AGREEMENT_KIND.terms} />;
}
export { Route };
