import { AGREEMENT_KIND } from "@repo/config";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { loadPublishedAgreement } from "#entities/agreement/index.ts";
import { LegalDocumentPage } from "#pages/legal/index.ts";

import type { ReactElement } from "react";

const Route = createFileRoute("/_public/privacy")({
  component: PrivacyRoute,
  loader: async () => loadPublishedAgreement(AGREEMENT_KIND.privacy),
});

const route = getRouteApi("/_public/privacy");

function PrivacyRoute(): ReactElement {
  return <LegalDocumentPage document={route.useLoaderData()} kind={AGREEMENT_KIND.privacy} />;
}

export { Route };
